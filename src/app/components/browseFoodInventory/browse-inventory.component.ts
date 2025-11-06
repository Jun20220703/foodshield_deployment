import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { BrowseFoodService, Food } from '../../services/browse-food.service';
import { Router } from '@angular/router';

// ⭐新增：用于判断是否在浏览器端
import { isPlatformBrowser } from '@angular/common';
import { Inject, PLATFORM_ID } from '@angular/core';



interface Item {
  _id: string;
  name: string;
  qty: number; // 唯一数量字段
  selectedQty: number;
  source: 'inventory' | 'donation' | 'expired';
  expiry: string;
  notes?: string;
  owner?: string;

  // ✅ 新增：来自 DonationList 的字段
  donationAvailability?: string;
  donationLocation?: string;
}

type CategoryKey =
  | 'all'
  | 'fruit'
  | 'vegetable'
  | 'meat'
  | 'grain'
  | 'dairy'
  | 'others';

interface Category {
  name: string;
  key: CategoryKey;
  colorClass: string;
  icon: string;
  items: Item[];
}

interface Location {
  name: string;
  categories: Category[];
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  templateUrl: './browse-inventory.component.html',
  styleUrls: ['./browse-inventory.component.css'],
  imports: [CommonModule, FormsModule, SidebarComponent],
})
export class InventoryComponent implements OnInit {
  constructor(
    private cdr: ChangeDetectorRef,
    private browseService: BrowseFoodService,
    private router: Router   // ✅ 新增
    
  ) {}

  /** 页面状态 */
  viewTitle: string = 'Inventory';
  selectedSource: 'inventory' | 'donation' = 'inventory';
  selectedLocation: string = 'All';

    // ✅ 新增：提示消息
  successMessage: string | null = null;

  showFilter = false;
  showSearch = false;
  searchQuery: string = '';
  hoverItem: Item | null = null;
  hoverItemNotes: string | null = null;

  showConfirm = false;
  confirmItem: Item | null = null;
  confirmAction: 'used' | 'meal' | 'donate' | 'edit' | null = null;

  /** 筛选条件 */
  filter = {
    donation: false,
    inventory: true,
    categories: {} as { [key in CategoryKey]?: boolean },
    expiredIn: 0,
  };

  /** 数据缓存 */
  viewLocs: Location[] = [];
  rawFoods: Food[] = [];
  private expiredSet = new Set<string>();

  ngOnInit() {
    this.loadFoods();
  }

  /** 从 API 获取数据 */
  loadFoods() {
    this.browseService.getFoods().subscribe((data: Food[]) => {
      console.log('📦 API 返回数据:', data);

      this.rawFoods = data.map((food) => ({
        ...food,
        qty: Number(food.qty ?? 0),
      }));

      this.ensureCategoryKeysInitialized(true);
      this.refreshView();
    });
  }

  /** 动态 Storage 下拉 */
  get availableLocations(): string[] {
    const set = new Set<string>();
    this.rawFoods.forEach((food) => {
      if (this.matchSource(food.status as 'inventory' | 'donation')) {
        set.add(food.storage || 'Unknown');
      }
    });
    return Array.from(set);
  }

  /** 动态分类下拉 */
  get availableCategories(): { key: CategoryKey; name: string }[] {
    const list: { key: CategoryKey; name: string }[] = [];
    const exists = new Set<CategoryKey>();

    this.rawFoods.forEach((food) => {
      const key = this.mapCategoryKey(food.category);
      if (key === 'all') return;
      if (
        this.matchSource(food.status as 'inventory' | 'donation') &&
        !exists.has(key)
      ) {
        exists.add(key);
        const displayName = key.charAt(0).toUpperCase() + key.slice(1);
        list.push({ key, name: displayName });
      }
    });

    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }

  /** 初始化分类布尔值 */
  private ensureCategoryKeysInitialized(setDefaultTrue = false) {
    const keys = this.availableCategories.map((c) => c.key);
    keys.forEach((k) => {
      if (this.filter.categories[k] === undefined) {
        this.filter.categories[k] = setDefaultTrue
          ? true
          : !!this.filter.categories.all;
      }
    });

    if (this.filter.categories.all === undefined) {
      this.filter.categories.all =
        keys.length === 0
          ? true
          : keys.every((k) => this.filter.categories[k] === true);
    } else {
      if (this.filter.categories.all) {
        keys.forEach((k) => {
          if (this.filter.categories[k] === undefined)
            this.filter.categories[k] = true;
        });
      }
    }
  }

  /** 构建 Storage → Category → Items */
  private buildLocations(): Location[] {
    const map: { [storage: string]: Location } = {};

    this.rawFoods.forEach((food) => {
      if (!this.matchSource(food.status as 'inventory' | 'donation')) return;

      const locName = food.storage || 'Unknown';
      if (!map[locName]) {
        map[locName] = { name: locName, categories: [] };
      }

      const key = this.mapCategoryKey(food.category);
      let category = map[locName].categories.find((c) => c.key === key);
      if (!category) {
        category = {
          name: key === 'all' ? 'Others' : food.category || 'Others',
          key,
          colorClass: key,
          icon: this.getCategoryIcon(key),
          items: [],
        };
        map[locName].categories.push(category);
      }

      category.items.push({
        _id: food._id!,
        name: food.name,
        qty: Number(food.qty ?? 0),
        selectedQty: 0,
        source:
          food.status === 'donation'
            ? 'donation'
            : food.status === 'expired'
            ? 'expired'
            : 'inventory',
        expiry: food.expiry,
        notes: food.notes,
        owner: food.owner,

        // ✅ 新增：把 rawFoods 里的扩展属性映射进 Item
        donationAvailability: (food as any).donationAvailability,
        donationLocation: (food as any).donationLocation,
      });
    });

    return Object.values(map);
  }

  /** 分类 key */
  private mapCategoryKey(category: string): CategoryKey {
    const c = (category || '').trim().toLowerCase();
    const singular = c.endsWith('s') ? c.slice(0, -1) : c;
    if (singular.includes('fruit')) return 'fruit';
    if (singular.includes('vegetable')) return 'vegetable';
    if (singular.includes('meat')) return 'meat';
    if (singular.includes('grain') || singular.includes('carb')) return 'grain';
    if (singular.includes('dairy')) return 'dairy';
    if (singular.includes('other')) return 'others';
    return 'all';
  }

  private getCategoryIcon(key: CategoryKey): string {
    switch (key) {
      case 'fruit':
        return '🍎';
      case 'vegetable':
        return '🥦';
      case 'meat':
        return '🍖';
      case 'grain':
        return '🌾';
      case 'dairy':
        return '🥛';
      default:
        return '📦';
    }
  }

  private matchSource(source: 'inventory' | 'donation') {
    if (this.filter.inventory && !this.filter.donation)
      return source === 'inventory';
    if (this.filter.donation && !this.filter.inventory)
      return source === 'donation';
    return true;
  }

  /** 刷新界面 */
  refreshView() {
    this.ensureCategoryKeysInitialized();
    let locs = this.buildLocations();

    if (this.selectedLocation !== 'All') {
      locs = locs.filter((l) => l.name === this.selectedLocation);
    }

    const allowed = new Set<CategoryKey>(
      this.availableCategories
        .map((c) => c.key)
        .filter((k) => this.filter.categories[k] === true)
    );

    locs = locs
      .map((loc) => ({
        ...loc,
        categories: loc.categories
          .map((cat) => ({
            ...cat,
            items: allowed.has(cat.key) ? cat.items : [],
          }))
          .filter((cat) => cat.items.length > 0),
      }))
      .filter((loc) => loc.categories.length > 0);

    if (this.searchQuery.trim() !== '') {
      const q = this.searchQuery.toLowerCase();
      locs = locs
        .map((loc) => ({
          ...loc,
          categories: loc.categories
            .map((cat) => ({
              ...cat,
              items: cat.items.filter((i) => i.name.toLowerCase().includes(q)),
            }))
            .filter((cat) => cat.items.length > 0),
        }))
        .filter((loc) => loc.categories.length > 0);

      // ✅ 如果没找到任何结果
      if (locs.length === 0) {
        alert(`${this.searchQuery} does not exist ❌`);

        // 清空搜索并刷新所有项目
        this.searchQuery = '';
        this.refreshView();
        return; // 防止继续执行
      }
    }

    this.viewLocs = locs;
    this.cdr.detectChanges();

    // ✅ 空状态提示逻辑
    if (this.viewLocs.length === 0) {
      if (this.selectedSource === 'inventory') {
        this.successMessage = "There is no food items in inventory 🍂";
      } else if (this.selectedSource === 'donation') {
        this.successMessage = "There is no donation items available 🍂";
      }
    } else {
      this.successMessage = null;
    }
  }



  /** ✅ UI 控制方法（补齐防止报错） */
  toggleFilterPanel() {
    this.showFilter = !this.showFilter;
  }

  toggleSearchBar() {
    this.showSearch = !this.showSearch;
    if (!this.showSearch) {
      this.searchQuery = '';
      this.refreshView();
    }
  }

  toggleSource(source: 'donation' | 'inventory') {
    this.selectedSource = source;
    this.filter.donation = source === 'donation';
    this.filter.inventory = source === 'inventory';
    this.viewTitle = source === 'inventory' ? 'Inventory' : 'Donation List';

    this.ensureCategoryKeysInitialized(true);
    this.filter.categories.all = true;
    this.availableCategories.forEach(
      (c) => (this.filter.categories[c.key] = true)
    );

    if (source === 'donation') {
      this.browseService.getDonations().subscribe((donations: any[]) => {
      this.rawFoods = donations.map(d => ({
        ...d.foodId,                    // Food 基本信息（name/category/expiry/storage…）
        qty: d.qty,                     // ✅ DonationList 数量
        notes: d.notes,                 // ✅ DonationList 备注
        status: 'donation',
        owner: d.owner,

        // ✅ 新增：DonationList 的字段（先存到 raw 里，后面 buildLocations 映射进 Item）
        donationAvailability: d.availability,
        donationLocation: d.location,
        donationId: d._id
      }));
      this.ensureCategoryKeysInitialized(true);
      this.refreshView();
      });
    } else {
      this.loadFoods(); // 走 inventory 的逻辑
    }

    this.showSearch = false;
    this.showFilter = false;
  }

  /** 分类勾选 */
  onCategoryChange(key: CategoryKey, checked: boolean) {
    this.filter.categories[key] = checked;
    const keys = this.availableCategories.map((c) => c.key);
    this.filter.categories.all =
      keys.length === 0
        ? true
        : keys.every((k) => this.filter.categories[k] === true);
    this.refreshView();
  }

  onCategoryAllToggle(checked: boolean) {
    this.filter.categories.all = checked;
    this.availableCategories.forEach(
      (c) => (this.filter.categories[c.key] = checked)
    );
    this.refreshView();
  }

  /** Expired 过滤 */
  applyExpiredFilter() {
    if (this.selectedSource !== 'inventory') {
      this.refreshView();
      return;
    }
    const limit = Number(this.filter.expiredIn);
    if (!limit || limit <= 0) {
      this.refreshView();
      return;
    }

    this.ensureCategoryKeysInitialized();
    let locs = this.buildLocations();

    if (this.selectedLocation !== 'All') {
      locs = locs.filter((l) => l.name === this.selectedLocation);
    }

    const allowed = new Set<CategoryKey>(
      this.availableCategories
        .map((c) => c.key)
        .filter((k) => this.filter.categories[k] === true)
    );

    locs = locs
      .map((loc) => ({
        ...loc,
        categories: loc.categories
          .map((cat) => ({
            ...cat,
            items: allowed.has(cat.key)
              ? cat.items.filter((i) => {
                  const days = this.getRemainingDays(i.expiry);
                  return days >= 0 && days <= limit;
                })
              : [],
          }))
          .filter((cat) => cat.items.length > 0),
      }))
      .filter((loc) => loc.categories.length > 0);

    this.viewLocs = locs;
    this.cdr.detectChanges();
  }

  resetExpiredFilter() {
    this.filter.expiredIn = 0;
    this.refreshView();
  }

  /** 数量增加 */
  increaseSelected(item: Item) {
    if (item.selectedQty < item.qty) {
      item.selectedQty++;
    } else {
      // ✅ 已经到最大数量了
      alert(`${item.name} reach the maximum quantity 🚫`);
    }
  }

  decreaseSelected(item: Item) {
    if (item.selectedQty > 0) item.selectedQty--;
  }

  /** 弹窗逻辑 */
  openConfirm(item: Item, action: 'used' | 'meal' | 'donate' | 'edit') {
    console.log('🟢 openConfirm', item.name, 'action:', action, 'selectedQty:', item.selectedQty);

    // ✅ donate 不要直接跳转
    if (action !== 'edit' && action !== 'donate' && item.selectedQty <= 0) return;

    this.confirmItem = item;
    this.confirmAction = action;
    this.showConfirm = true;
  }


  closeConfirm() {
    this.showConfirm = false;
    this.confirmItem = null;
    this.confirmAction = null;
    this.cdr.detectChanges();
  }

  /** 执行动作 */
  confirmActionProceed() {
      if (!this.confirmItem || !this.confirmAction) return;

      if (this.confirmAction === 'used' || this.confirmAction === 'meal') {
        const item = this.confirmItem;
        const newQty = item.qty - item.selectedQty;

        this.browseService.updateFoodQty(item._id, newQty).subscribe({
          next: () => {
            // ✅ 更新前端 qty
            item.qty = newQty;
            item.selectedQty = 0;

            // ✅ 浏览器弹窗提示
            alert(`\nUsed ${item.name} successfully✅`);
          },
          error: (err) => {
            console.error('❌ 更新失败:', err);
            alert(`\nFailed to update ${item.name}❌`);
          },
        });

      }

      if (this.confirmAction === 'donate') {
        this.router.navigate(['/manage-inventory'], {
          queryParams: { donateId: this.confirmItem._id },
        });
      }

      if (this.confirmAction === 'edit') {
        const editId =
          (this.confirmItem as any).donationId || this.confirmItem._id;
        this.router.navigate(['/donation-list'], {
          queryParams: { editId, returnTo: 'browse' },
        });
      }

      this.closeConfirm();
    }




  /** 过期计算 */
  getRemainingDays(expiryDate: string): number {
    if (!expiryDate) return 0;
    const exp = new Date(expiryDate);
    if (isNaN(exp.getTime())) return 0;
    const today = new Date();
    return Math.ceil(
      (exp.getTime() - today.getTime()) / (1000 * 3600 * 24)
    );
  }

  getExpiryClass(item: Item): string {
    const days = this.getRemainingDays(item.expiry);
    if (days <= 0) {
      this.autoExpireItem(item);
      return 'expired';
    }
    if (days < 5) return 'red';
    if (days < 7) return 'yellow';
    return 'green';
  }

  private autoExpireItem(item: Item) {
    if (item.source === 'expired' || this.expiredSet.has(item._id)) return;
    this.expiredSet.add(item._id);

    this.browseService.updateFoodStatus(item._id, 'expired').subscribe({
      next: () => {
        item.qty = 0;
        console.log(`⚠️ ${item.name} 已过期 → 数量设为 0`);
      },
      error: (err) => console.error('❌ 自动过期失败:', err),
    });
  }
}
