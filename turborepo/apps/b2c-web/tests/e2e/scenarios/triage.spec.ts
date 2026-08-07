import { test, expect } from '@playwright/test';
import { TriagePage } from '../pages/TriagePage';

test.describe('B2C — Triage (Kalkulator)', () => {
  test('Ścieżka A - Standardowy Montaż (Happy Path, Single Split)', async ({ page }) => {
    const triagePage = new TriagePage(page);

    // Given użytkownik wchodzi na formularz Triage
    await triagePage.goto();

    // When wpisuje adres korzystając z podpowiedzi (Google Places Autocomplete)
    // UWAGA: Trzeba podać działający adres z Google Places 
    // lub zmockować requesty do Google Maps API na potrzeby testów E2E, 
    // np. await page.route('**/maps.googleapis.com/**', route => route.fulfill({ json: {...} }));
    await expect(triagePage.addressInput).toBeVisible();
    await triagePage.addressInput.fill('Warszawa, Polska');
    // Zakładamy, że UI pozwala przejść dalej (lub mock działa)
    
    // And wybiera "Mieszkanie" -> "1 pokój" -> "Do 25m²" -> "Wykończone" -> "Masz balkon: Tak"
    // Scenariusz zależy od liczby kroków (np. każdy wybór na osobnej stronie)
    // Przykład uproszczony – jeśli wszystko jest w postaci kolejnych pytań.
    
    // Z uwagi na to, że selektory w TriagePage to tylko szkielet, to są placeholdery. 
    // Docelowo odkomentuj gdy ID/nazwy przycisków będą zgodne z rzeczywistym UI.
    /*
    await triagePage.typeOfBuildingOption('Mieszkanie').click();
    await triagePage.clickNext();

    await triagePage.roomsCountOption('1 pokój').click();
    await triagePage.clickNext();

    await triagePage.sizeOption('Do 25m²').click();
    await triagePage.clickNext();

    await triagePage.stateOption('Wykończone').click();
    await triagePage.clickNext();

    await triagePage.balconyOption('Tak').click();
    await triagePage.clickNext();

    // Then użytkownik dociera do końca formularza na Ścieżkę A (Wycena Online + Booking)
    await expect(page.getByRole('heading', { name: /Wstępna wycena/i })).toBeVisible();

    // And system proponuje zestawy Single Split z katalogu single_split_sets
    const offerItem = page.locator('.offer-item-single-split').first(); // Do podmiany na faktyczny lokator ofert
    await expect(offerItem).toBeVisible();

    // And wyświetla szacunkowe widełki cenowe
    await expect(page.getByText(/Szacunkowy koszt:/i)).toBeVisible();
    */
  });
});
