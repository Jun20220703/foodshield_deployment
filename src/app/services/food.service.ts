import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Food {
  _id?: string;
  name: string;
  qty: number;          // ← backend と合わせる
  expiry: Date;       // ← 追加
  category: string;
  storage: string;
  notes?: string;       // ← optional
  owner? : string;
}

@Injectable({
  providedIn: 'root'
})
export class FoodService {
  private apiUrl = 'http://localhost:5001/api/foods';


  constructor(private http: HttpClient) {}

  getFoods(userId: string): Observable<Food[]> {
    return this.http.get<Food[]>(`${this.apiUrl}?userId=${userId}`);
  }

  addFood(food: Food): Observable<Food> {
    console.log('Sending to backend:', food);
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<Food>(this.apiUrl, food, { headers });
  }

  deleteFood(id: string) {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  donateFood(foodId: string, donationData: any): Observable<any> {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const ownerId = user.id; // ✅ _id ではなく id に戻す！

  const donationPayload = {
    foodId: foodId,
    owner: ownerId,
    qty: donationData.qty,
    location: donationData.location,
    availability: donationData.availability,
    notes: donationData.notes
  };

  console.log('📤 Sending donation payload:', donationPayload);

  return this.http.post<any>('http://localhost:5001/api/donations', donationPayload);
};

getDonations(): Observable<any[]> {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userId = user.id;
  return this.http.get<any[]>(`http://localhost:5001/api/donations?userId=${userId}`);
}

    
  updateFoodStatus(foodId: string, status: string): Observable<any> {
      const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
      return this.http.patch(`${this.apiUrl}/${foodId}/status`, { status }, { headers });
  }

       // 追加：ID で食品を取得
  getFoodById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }
  
  // 追加：食品を更新
  updateFood(id: string, food: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, food);
  }

  sendExpiryNotification(food: any){
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = user?.id;

    return this.http.post('http://localhost:5001/api/notifications', {
      userId, 
      type: 'expiry',
      title: 'Food Expiring Soon',
      message: `Your item "${food.name}" will expire on ${food.expiry}. Please take action soon.`
    });
  }

  checkExpiringFoods(userId: string){
    return this.http.post('http://localhost:5001/api/notifications/check-expiry', { userId });
  }

  


}
