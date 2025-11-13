require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const Food = require('./models/Food');
const foodRoutes = require('./routes/foodRoutes');   // 增删改查
const browseFood = require('./routes/browseFood');   // 只读浏览
const userRoutes = require('./routes/users');        // 用户相关
const donationRoutes = require('./routes/donationRoutes');
const DonationList = require('./models/DonationList');
const analyticsRoute = require('./routes/analyticsRoute');  // ✅ Add this




const app = express();
const PORT = process.env.PORT || 5001;

/* Connect to MongoDB Atlas */
mongoose.connect("mongodb+srv://kkjhhyu0405:kjh030407@cluster0.chogk.mongodb.net/foodShield?retryWrites=true&w=majority", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  dbName: 'foodShield'
})
.then(() => {
  console.log('✅ MongoDB Atlas connect successfully!');
})
.catch((error) => {
  console.log('❌ MongoDB connection Fail:', error);
  console.log('Detailed error information:', {
    name: error.name,
    message: error.message,
    code: error.code
  });
});

/* Middleware */
app.use(cors({
  origin: 'http://localhost:4200',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* Routes */
app.use('/api/users', userRoutes);       // 用户路由
app.use('/api/foods', foodRoutes);       // 增删改查
app.use('/api/browse', browseFood);      // 浏览
app.use('/api/donations', donationRoutes);
app.use("/api/analytics", require("./routes/analyticsRoute"));  // ✅ Add this line




// 基础测试路由
app.get('/', (req, res) => {
  res.json({ message: 'Food Shield API Server is running!' });
});


//Add item API
app.post('/api/foods', async (req, res) => {
  try{
    console.log("Received POST /api/foods:", req.body);
    const newFood = new Food(req.body);
    await newFood.save();
    res.status(201).json(newFood);
  } catch (error){
    console.error("Error savinf food:", error);
    res.status(400).json({message: error.message});
  }
});

app.get('/api/foods', async(req, res) => {
  try{
    const userId = req.query.userId; // frontendからクエリで渡す
    const foods = await Food.find({owner: userId});
    res.json(foods);
  } catch (error){
    res.status(500).json({message: 'Error fetching foods',error});
  }
});

// delete food item from manage-inventory
app.delete('/api/foods/:id', async (req, res) => {
  try {
    const deletedFood = await Food.findByIdAndDelete(req.params.id);
    if (!deletedFood) {
      return res.status(404).json({ message: 'Food not found' });
    }
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('Error deleting food:', error);
    res.status(500).json({ message: 'Server error while deleting food' });
  }
});

app.post('/api/donations', async(req, res)=>{
  try{
    const { foodId, owner, qty, location, availability, notes } = req.body;

    if (!foodId ||  !owner || !qty || !location || !availability) {
      return res.status(400).json({ message: 'Missing required fields' });
    }


      const donation = new DonationList({
          foodId,
          owner,        // 👈 追加
          qty,
          location,
          availability,
          notes,
          donationAt: new Date()
      });
      await donation.save();

      await Food.findByIdAndUpdate(foodId, 
      {
        status:'donation',
        location, 
        availability, 
        notes
      });
    
      res.status(201).json({message: 'Donation successfully saved', donation});
    } catch(error){
      console.error('Error saving donation: ', error);
      res.status(500).json({message: 'Server error', error});
    }
});
app.get('/api/donations', async (req, res) => {
  try {
    // populateで関連するFoodの詳細を取得
    const donations = await DonationList.find()
      .populate('foodId', 'name qty expiry category storage status location availability notes');

    res.json(donations);
  } catch (error) {
    console.error('Error fetching donations:', error);
    res.status(500).json({ message: 'Error fetching donations', error });
  }
});
app.options('/api/foods/:id/status', cors());

// ✅ Update food item (qty, etc.) - split consumed quantity into new item, keep remainder in inventory
app.put('/api/foods/:id', async (req, res) => {
  try {
    const { qty } = req.body;
    
    // Get current food item to compare qty
    const currentFood = await Food.findById(req.params.id);
    if (!currentFood) {
      return res.status(404).json({ message: 'Food not found' });
    }
    
    // If qty is being decreased (used/consumed), split the item
    if (qty !== undefined && qty < currentFood.qty && currentFood.status === 'inventory') {
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
      const updatedFood = await Food.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      );
      
      console.log(`✅ Updated original item: ${currentFood.name} (qty: ${qty}, status: inventory)`);
      return res.json(updatedFood);
    }
    
    // If qty is not decreased or status is not inventory, just update normally
    const updateData = { ...req.body };
    const updatedFood = await Food.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    
    res.json(updatedFood);
  } catch (error) {
    console.error('Error updating food:', error);
    res.status(500).json({ message: 'Server error while updating food', error });
  }
});






// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

/* 404 handling */
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

/* Start server */
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
