import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DonationService {
  private apiUrl = 'http://localhost:5001/api/donations'; // ←バックエンド URL に合わせてください

  constructor(private http: HttpClient) {}

  // Get all donations (or by user)
  getDonations(userId?: string): Observable<any[]> {
    const url = userId ? `${this.apiUrl}?userId=${userId}` : this.apiUrl;
    return this.http.get<any[]>(url);
  }

  // Get a single donation by ID
  getDonationById(id: string): Observable<any> {
  return this.http.get<any>(`http://localhost:5001/api/donations/${id}`);
}


  // Update a donation
  updateDonation(id: string, data: any): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.put<any>(`${this.apiUrl}/${id}`, data, { headers });
  }

  // Delete a donation
  deleteDonation(id: string) {
  return this.http.delete(`http://localhost:5001/api/donations/${id}`);
}



  // Add a new donation
  addDonation(data: any): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<any>(this.apiUrl, data, { headers });
  }


  
}
