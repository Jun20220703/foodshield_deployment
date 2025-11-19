const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Food = require('../models/Food');
const CustomMeal = require('../models/CustomMeal');
const MarkedFood = require('../models/MarkedFood');

/**
 * Auto-update food items that have ALREADY expired (expiry date < today) to "expired" status
 * IMPORTANT: This function IGNORES startUTC/endUTC parameters and only expires foods that have already passed their expiry date
 */
async function autoUpdateExpiredFoods(ownerId, startUTC, endUTC) {
  try {
    // Calculate today's start in Malaysia timezone (UTC+8), then convert to UTC
    // This ensures we only expire foods that have ALREADY passed their expiry date
    const now = new Date();
    const MYT_OFFSET_MS = 8 * 60 * 60 * 1000; // +8 hours in milliseconds
    
    // Get current time in MYT (add 8 hours to UTC)
    const nowMYT = new Date(now.getTime() + MYT_OFFSET_MS);
    
    // Extract year, month, day from MYT time
    const year = nowMYT.getUTCFullYear();
    const month = nowMYT.getUTCMonth();
    const day = nowMYT.getUTCDate();
    
    // Create today's start (00:00:00) in MYT as UTC date
    const todayStartMYT = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    
    // Convert MYT 00:00:00 to UTC (subtract 8 hours)
    const todayStartUTC = new Date(todayStartMYT.getTime() - MYT_OFFSET_MS);
    
    // Only update foods that have ALREADY expired (expiry < today's start in UTC)
    // IGNORE the startUTC/endUTC parameters passed from analytics API
    const updateResult = await Food.updateMany(
      {
        ...(ownerId && { owner: ownerId }),
        expiry: { $lt: todayStartUTC }, // Only foods that expired BEFORE today
        status: { $in: ["inventory", "donation"] } // Only update if still in inventory or donation status
      },
      { 
        $set: { status: "expired" }
      }
    );
    
    return updateResult.modifiedCount;
  } catch (err) {
    console.error("🔥 Error auto-updating expired foods:", err);
    return 0;
  }
}

/**
 * Process past planned meals and consume their ingredients
 * This function finds all custom meals where the planned date has passed,
 * and consumes the ingredients (regardless of marked/non-marked status)
 */
async function processPastMeals(ownerId) {
  try {
    // Calculate today's start in Malaysia timezone (UTC+8), then convert to UTC
    const now = new Date();
    const MYT_OFFSET_MS = 8 * 60 * 60 * 1000; // +8 hours in milliseconds
    const nowMYT = new Date(now.getTime() + MYT_OFFSET_MS);
    const year = nowMYT.getUTCFullYear();
    const month = nowMYT.getUTCMonth();
    const day = nowMYT.getUTCDate();
    const todayStartMYT = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    const todayStartUTC = new Date(todayStartMYT.getTime() - MYT_OFFSET_MS);
    
    const todayDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Find all custom meals for this owner where date < today
    const customMeals = await CustomMeal.find({ owner: ownerId });
    
    const pastMeals = customMeals.filter((meal) => {
      if (!meal.date) {
        return false;
      }
      // Parse meal date (YYYY-MM-DD format)
      const mealDate = new Date(meal.date);
      mealDate.setHours(0, 0, 0, 0);
      const todayDate = new Date(todayDateStr);
      todayDate.setHours(0, 0, 0, 0);
      
      const isPast = mealDate < todayDate;
      return isPast;
    });
    
    if (pastMeals.length === 0) {
      return 0;
    }
    
    let totalConsumed = 0;
    
    // Process each past meal
    for (const meal of pastMeals) {
      if (!meal.ingredients || !meal.ingredients.trim()) {
        continue;
      }
      
      // Check if this meal's ingredients have already been consumed
      // by checking if consumed items exist with createdAt matching the meal date
      // This prevents duplicate processing if processPastMeals is called multiple times
      const mealDateStart = new Date(meal.date);
      mealDateStart.setHours(0, 0, 0, 0);
      const mealDateEnd = new Date(meal.date);
      mealDateEnd.setHours(23, 59, 59, 999);
      
      // Parse ingredients to get count - if we have N ingredients, we expect at least N consumed items
      const ingredientLines = meal.ingredients.split(/[,\n]/).filter(line => line.trim().length > 0);
      const expectedMinConsumed = ingredientLines.length;
      
      // Check if there are already consumed items created on the meal date
      // Only skip if there are significantly more consumed items than expected (suggesting already processed)
      const existingConsumed = await Food.countDocuments({
        owner: ownerId,
        status: 'consumed',
        createdAt: { $gte: mealDateStart, $lte: mealDateEnd }
      });
      
      // Skip if there are already many consumed items for this date (likely already processed)
      // Use a threshold: if existing consumed items >= expected ingredients * 2, skip
      if (existingConsumed >= expectedMinConsumed * 2) {
        continue;
      }
      
      try {
        const consumed = await consumePastMealIngredients(meal.ingredients, meal.date, ownerId);
        totalConsumed += consumed;
      } catch (err) {
        console.error(`❌ Error processing past planned meal ${meal.foodName}:`, err);
      }
    }
    
    return totalConsumed;
  } catch (err) {
    console.error('🔥 Error in processPastMeals:', err);
    return 0;
  }
}

/**
 * Consume ingredients from a past planned meal
 * Parses ingredients string and consumes them from inventory (marked or non-marked)
 */
async function consumePastMealIngredients(ingredientsStr, mealDate, ownerId) {
  console.log('🔄 Starting consumePastMealIngredients with mealDate:', mealDate);
  
  if (!ingredientsStr || !ingredientsStr.trim()) {
    console.warn('⚠️ No ingredients string provided');
    return 0;
  }
  
  // Parse ingredients - try comma-separated first, then newline-separated
  let lines = [];
  const commaSeparated = ingredientsStr.split(',').map(item => item.trim()).filter(item => item);
  
  if (commaSeparated.length > 1) {
    lines = commaSeparated;
    console.log('📝 Parsed as comma-separated format, lines:', lines.length);
  } else {
    lines = ingredientsStr.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    console.log('📝 Parsed as newline-separated format, lines:', lines.length);
  }
  
  const ingredients = [];
  
  for (const line of lines) {
    // Extract inventory type: [marked] or [non-marked]
    const typeMatch = line.match(/\s+\[(marked|non-marked)\]\s*/);
    const inventoryType = typeMatch ? typeMatch[1] : 'marked';
    const lineWithoutType = typeMatch ? line.substring(0, typeMatch.index).trim() : line;
    
    // Extract quantity and name
    let quantity = 0;
    let originalName = '';
    
    const quantityMatch = lineWithoutType.match(/\s+(\d+(?:\.\d+)?)\s*(g|kg|ml|l|tbsp|tsp|cup|cups|oz|lb|개|조각|컵|스푼|작은술|큰술)?\s*$/i);
    if (quantityMatch) {
      quantity = parseFloat(quantityMatch[1]);
      originalName = lineWithoutType.substring(0, quantityMatch.index).trim();
    } else {
      const numberMatch = lineWithoutType.match(/\s+(\d+(?:\.\d+)?)\s*$/);
      if (numberMatch) {
        quantity = parseFloat(numberMatch[1]);
        originalName = lineWithoutType.substring(0, numberMatch.index).trim();
      } else {
        console.warn(`⚠️ No quantity found in line: "${line}"`);
        continue;
      }
    }
    
    if (originalName && quantity > 0) {
      ingredients.push({
        originalName: originalName.trim(),
        normalizedName: originalName.toLowerCase().trim(),
        quantity,
        inventoryType
      });
    }
  }
  
  console.log(`📋 Parsed ${ingredients.length} valid ingredients`);
  
  if (ingredients.length === 0) {
    return 0;
  }
  
  // Get all marked foods and non-marked foods
  const markedFoods = await MarkedFood.find({ owner: ownerId });
  const allFoods = await Food.find({ owner: ownerId });
  
  console.log(`📦 Loaded ${markedFoods.length} marked foods and ${allFoods.length} non-marked foods`);
  
  let consumedCount = 0;
  
  // Process each ingredient
  for (const ingredient of ingredients) {
    console.log(`\n🔍 Processing ingredient: ${ingredient.originalName} (qty: ${ingredient.quantity}, type: ${ingredient.inventoryType})`);
    let remainingQty = ingredient.quantity;
    
    // Step 1: If ingredient is marked, reduce from marked foods first and consume original food
    if (ingredient.inventoryType === 'marked') {
      const markedFood = markedFoods.find(mf => {
        const foodNameNormalized = (mf.name || '').toLowerCase().trim();
        return foodNameNormalized === ingredient.normalizedName;
      });
      
      if (markedFood && markedFood._id) {
        console.log(`  - ✅ Found marked food: ${markedFood.name}, qty: ${markedFood.qty}`);
        const qtyFromMarked = Math.min(markedFood.qty || 0, remainingQty);
        
        // Reduce marked food quantity
        const newMarkedQty = Math.max(0, (markedFood.qty || 0) - qtyFromMarked);
        
        if (newMarkedQty === 0) {
          await MarkedFood.findByIdAndDelete(markedFood._id);
          console.log(`✅ Deleted marked food "${ingredient.originalName}"`);
        } else {
          markedFood.qty = newMarkedQty;
          await markedFood.save();
          console.log(`✅ Reduced marked food "${ingredient.originalName}" to ${newMarkedQty}`);
        }
        
        // Consume from original food item (using foodId from marked food)
        if (markedFood.foodId) {
          const originalFood = allFoods.find(f => {
            const foodIdStr = String(f._id || '');
            return foodIdStr === String(markedFood.foodId);
          });
          
          if (originalFood && originalFood._id) {
            const qtyToConsume = Math.min(originalFood.qty || 0, qtyFromMarked);
            const newFoodQty = Math.max(0, (originalFood.qty || 0) - qtyToConsume);
            
            if (newFoodQty === 0) {
              await Food.findByIdAndDelete(originalFood._id);
              console.log(`✅ Deleted original food "${ingredient.originalName}"`);
            } else {
              // Create consumed item with mealDate as createdAt
              const consumedFood = new Food({
                name: originalFood.name,
                qty: qtyToConsume,
                expiry: originalFood.expiry,
                category: originalFood.category,
                storage: originalFood.storage,
                notes: originalFood.notes,
                status: 'consumed',
                owner: originalFood.owner,
                createdAt: new Date(mealDate),
                updatedAt: new Date(mealDate)
              });
              await consumedFood.save();
              
              // Update original food quantity
              originalFood.qty = newFoodQty;
              originalFood.status = 'inventory';
              await originalFood.save();
              
              console.log(`✅ Consumed ${qtyToConsume} from original food "${ingredient.originalName}" (createdAt: ${mealDate})`);
              consumedCount++;
            }
          }
        }
        
        remainingQty -= qtyFromMarked;
      }
    }
    
    // Step 2: Consume remaining quantity from non-marked foods
    if (remainingQty > 0) {
      const food = allFoods.find(f => {
        const foodNameNormalized = (f.name || '').toLowerCase().trim();
        const nameMatches = foodNameNormalized === ingredient.normalizedName;
        const ownerMatches = String(f.owner) === String(ownerId);
        const statusMatches = !f.status || f.status === 'inventory';
        return nameMatches && ownerMatches && statusMatches;
      });
      
      if (food && food._id) {
        console.log(`  - ✅ Found non-marked food: ${food.name}, qty: ${food.qty}`);
        const qtyFromNonMarked = Math.min(food.qty || 0, remainingQty);
        const newNonMarkedQty = Math.max(0, (food.qty || 0) - qtyFromNonMarked);
        
        if (newNonMarkedQty === 0) {
          await Food.findByIdAndDelete(food._id);
          console.log(`✅ Deleted non-marked food "${ingredient.originalName}"`);
        } else {
          // Create consumed item with mealDate as createdAt
          const consumedFood = new Food({
            name: food.name,
            qty: qtyFromNonMarked,
            expiry: food.expiry,
            category: food.category,
            storage: food.storage,
            notes: food.notes,
            status: 'consumed',
            owner: food.owner,
            createdAt: new Date(mealDate),
            updatedAt: new Date(mealDate)
          });
          await consumedFood.save();
          
          // Update original food quantity
          food.qty = newNonMarkedQty;
          food.status = 'inventory';
          await food.save();
          
          console.log(`✅ Consumed ${qtyFromNonMarked} from non-marked food "${ingredient.originalName}" (createdAt: ${mealDate})`);
          consumedCount++;
        }
      }
    }
  }
  
  console.log(`✅ consumePastMealIngredients completed. Consumed ${consumedCount} items.`);
  return consumedCount;
}

// ✅ update food item status (Donate / Inventory)
router.put('/status/:name', async (req, res) => {
  try {
    const { status } = req.body;
    const updated = await Food.findOneAndUpdate(
      { name: req.params.name },
      { status },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Food not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error updating food status', error });
  }
});



router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    const filter = userId ? { owner: userId } : {};
    
    // ✅ Auto-update foods that expire today to "expired" status
    // ✅ Process past planned meals and consume their ingredients
    if (userId) {
      const now = new Date();
      const MYT_OFFSET_MS = 8 * 60 * 60 * 1000; // +8 hours in milliseconds
      const nowMYT = new Date(now.getTime() + MYT_OFFSET_MS);
      const startMYT = new Date(nowMYT);
      startMYT.setUTCHours(0, 0, 0, 0);
      const endMYT = new Date(nowMYT);
      endMYT.setUTCHours(23, 59, 59, 999);
      const startUTC = new Date(startMYT.getTime() - MYT_OFFSET_MS);
      const endUTC = new Date(endMYT.getTime() - MYT_OFFSET_MS);
      
      const ownerId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
      
      // Process past meals first (consume ingredients)
      await processPastMeals(ownerId);
      
      // Then auto-update expired foods
      await autoUpdateExpiredFoods(ownerId, startUTC, endUTC);
    }
    
    const foods = await Food.find(filter);
    res.json(foods);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const food = await Food.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json(food);
  } catch (err) {
    res.status(500).json({ message: 'Error updating food status', error: err });
  }
});

// server.js or routes/foods.js
router.get('/:id', async (req, res) => {
  try {
    const food = await Food.findById(req.params.id); // Mongoose を想定
    if (!food) return res.status(404).json({ message: 'Food not found' });
    res.json(food);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// ✅ Update food item (qty, etc.) - split consumed quantity into new item, keep remainder in inventory
router.put('/:id', async (req, res) => {
  try {
    const { qty, action } = req.body;
    
    // Get current food item to compare qty
    const currentFood = await Food.findById(req.params.id);
    if (!currentFood) {
      return res.status(404).json({ message: 'Food not found' });
    }
    
    // Only create consumed item if action is 'used' and qty is being decreased
    // For 'meal' action, just update the quantity without creating consumed item
    if (qty !== undefined && qty < currentFood.qty && currentFood.status === 'inventory' && action === 'used') {
      const consumedQty = currentFood.qty - qty;
      
      // Create a new consumed item with the consumed quantity
      const consumedFood = new Food({
        name: currentFood.name,
        qty: consumedQty,
        expiry: currentFood.expiry,
        category: currentFood.category,
        storage: currentFood.storage,
        notes: currentFood.notes,
        status: 'consumed',
        owner: currentFood.owner
      });
      
      await consumedFood.save();
      console.log(`✅ Created consumed item: ${currentFood.name} (qty: ${consumedQty})`);
      
      // Update the original item with remaining quantity, keep status as "inventory"
      const updateData = { ...req.body, status: 'inventory' };
      // Remove action from updateData as it's not a Food model field
      delete updateData.action;
      const updatedFood = await Food.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      );
      
      console.log(`✅ Updated original item: ${currentFood.name} (qty: ${qty}, status: inventory)`);
      return res.json(updatedFood);
    }
    
    // If qty is not decreased, status is not inventory, or action is not 'used', just update normally
    const updateData = { ...req.body };
    // Remove action from updateData as it's not a Food model field
    delete updateData.action;
    const updatedFood = await Food.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    res.json(updatedFood);

    } catch (error) {                 // ← 1️⃣ Closing the try/catch
      res.status(500).json({ message: 'Server error while updating food', error: error.message });
    }

    });  
    
// Update food item by ID
router.put('/:id', async (req, res) => {
  try {
    console.log('📝 Updating food:', req.params.id, 'with data:', req.body);
    
    // Prepare update data - ensure all fields are included
    const updateData = {
      name: req.body.name,
      qty: req.body.qty,
      expiry: req.body.expiry,
      category: req.body.category,
      storage: req.body.storage,
      notes: req.body.notes
    };
    
    // Remove undefined fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });
    
    console.log('📝 Update data (cleaned):', updateData);
    
    const updatedFood = await Food.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }  // 更新後のデータを返す、バリデーションも実行
    );
    
    if (!updatedFood) {
      return res.status(404).json({ message: 'Food not found' });
    }
    
    console.log('✅ Food updated successfully:', updatedFood);
    res.json(updatedFood);
  } catch (error) {
    console.error('❌ Error updating food:', error);
    res.status(500).json({ message: 'Server error while updating food', error: error.message });
  }
});






module.exports = router;
