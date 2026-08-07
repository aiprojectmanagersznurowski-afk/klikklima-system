import { Page, Locator, expect } from '@playwright/test';

export class TriagePage {
  readonly page: Page;
  readonly addressInput: Locator;
  readonly typeOfBuildingOption: (type: string) => Locator;
  readonly roomsCountOption: (count: string) => Locator;
  readonly sizeOption: (size: string) => Locator;
  readonly stateOption: (state: string) => Locator;
  readonly balconyOption: (hasBalcony: string) => Locator;
  readonly nextButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // Poniższe selektory należy dostosować do rzeczywistej implementacji w UI.
    // Tutaj pokazany jest ogólny wzorzec z użyciem text/role.
    this.addressInput = page.getByPlaceholder(/Wpisz adres/i); // Przykładowy placeholder
    this.nextButton = page.getByRole('button', { name: /Dalej|Kontynuuj/i });
  }

  async goto() {
    await this.page.goto('/kalkulator'); // Przykładowy url do kalkulatora (triage)
  }

  typeOfBuildingOption(type: string) {
    return this.page.getByRole('button', { name: type, exact: true });
  }
  
  roomsCountOption(count: string) {
    return this.page.getByRole('button', { name: count, exact: true });
  }

  sizeOption(size: string) {
    return this.page.getByRole('button', { name: size, exact: true });
  }

  stateOption(state: string) {
    return this.page.getByRole('button', { name: state, exact: true });
  }

  balconyOption(hasBalcony: string) {
    return this.page.getByRole('button', { name: hasBalcony, exact: true });
  }

  async selectAddress(address: string) {
    await this.addressInput.fill(address);
    // Wybór z podpowiedzi Google Places - pierwsza pozycja na liście
    await this.page.locator('.pac-item').first().click(); 
  }

  async clickNext() {
    await this.nextButton.click();
  }
}
