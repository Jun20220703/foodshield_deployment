import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CustomMeal {
  _id?: string;
  foodName: string;
  ingredients: string;
  remark: string;
  kcal: string;
  photo?: string | null;
  date: string; // YYYY-MM-DD format
  mealType: string; // Breakfast, Lunch, Dinner, Snack
  owner?: string;
  createdAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CustomMealService {
  private apiUrl = 'http://localhost:5001/api/custom-meals';

  constructor(private http: HttpClient) {}

  createCustomMeal(mealData: CustomMeal): Observable<CustomMeal> {
    return this.http.post<CustomMeal>(this.apiUrl, mealData);
  }

  getCustomMeals(userId: string): Observable<CustomMeal[]> {
    return this.http.get<CustomMeal[]>(`${this.apiUrl}?userId=${userId}`);
  }

  getCustomMealById(id: string): Observable<CustomMeal> {
    return this.http.get<CustomMeal>(`${this.apiUrl}/${id}`);
  }

  updateCustomMeal(id: string, mealData: Partial<CustomMeal>): Observable<CustomMeal> {
    return this.http.put<CustomMeal>(`${this.apiUrl}/${id}`, mealData);
  }

  deleteCustomMeal(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}

