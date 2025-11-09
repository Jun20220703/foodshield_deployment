import { Routes } from '@angular/router';
import { InventoryComponent } from './components/browseFoodInventory/browse-inventory.component';
import { RegistrationPageComponent } from './components/registerAndPrivacySettings/registrationPage/registrationPage.component';
import { LoginPageComponent } from './components/registerAndPrivacySettings/loginPage/loginPage.component';
import { HomePageComponent } from './components/registerAndPrivacySettings/homePage/homePage.component';
import { AccountSettingsComponent } from './components/registerAndPrivacySettings/accountSettings/accountSettings.component';
import { PlanWeeklyMealComponent } from './components/planWeeklyMeal/planWeeklyMeal.component';
import { ManageFoodInventory } from './components/manageFoodInventory/manage-inventory.component';
import { AddFoodItemComponent } from './components/addFoodItem/add-food-item.component';
import { DonationListComponent } from './components/donationList/donation-list.component';
import { VerificationComponent } from './components/verification/verification.component';
import { EditFoodComponent } from './components/editFood/edit-food.component';
import { AddCustomMealComponent } from './components/planWeeklyMeal/addCustomMeal/add-custom-meal.component';
import { BrowseRecipesComponent } from './components/browseRecipes/browse-recipes.component';
import { EditDonationComponent } from './components/editDonation/edit-donation.component';
import { NotificationsListComponent } from './components/notifications/notifications-list.component';
import { MealDetailComponent } from './components/mealDetail/meal-detail.component';
export const routes: Routes = [
  { path: 'home', component: HomePageComponent },
  { path: 'inventory', component: InventoryComponent },
  { path: 'registration', component: RegistrationPageComponent },
  { path: 'login', component: LoginPageComponent },
  { path: 'account-settings', component: AccountSettingsComponent },
  { path: 'planWeeklyMeal', component: PlanWeeklyMealComponent },
  { path: 'manage-inventory', component: ManageFoodInventory},
  { path: 'add-food', component: AddFoodItemComponent},
  { path: 'add-custom-meal', component: AddCustomMealComponent},
  { path: 'browse-recipes', component: BrowseRecipesComponent},
  { path: 'meal-detail/:id', component: MealDetailComponent},
  { path: 'donation-list', component: DonationListComponent},
  { path: 'verification', component: VerificationComponent},
  { path: 'edit-food/:id', component: EditFoodComponent},
  { path: 'edit-donation/:id', component:EditDonationComponent},
  { path: 'notifications-list', component:NotificationsListComponent},
  { path: '', redirectTo: 'login', pathMatch: 'full' }
];
