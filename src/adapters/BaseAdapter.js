/**
 * Abstract Base Adapter for Heating Oil Price Scrapers
 * 
 * This class defines the contract that all provider adapters must implement.
 * It enforces a consistent interface for fetching prices.
 */
class BaseAdapter {
  constructor(providerName) {
    if (this.constructor === BaseAdapter) {
      throw new Error("BaseAdapter is an abstract class and cannot be instantiated directly.");
    }
    this.providerName = providerName;
  }

  /**
   * Fetches the heating oil price for a given zip code and amount.
   * 
   * @param {string} zipCode - The postal code (PLZ) to fetch prices for.
   * @param {number} amount - The amount of liters to query prices for.
   * @returns {Promise<Object>} - A promise resolving to the price object.
   *                              Structure: { provider: string, price: number, currency: string, amount_liters: number, zip_code: string, timestamp: string }
   * @throws {Error} - If the method is not implemented by the subclass.
   */
  async fetchPrice(zipCode, amount) {
    throw new Error("Method 'fetchPrice()' must be implemented.");
  }

  /**
   * Helper to format the result object.
   * 
   * @param {number} price - The fetched price per 100L.
   * @param {string} currency - The currency (e.g., 'CHF').
   * @param {string} zipCode - The standard zip code.
   * @param {number} amount - The amount in liters.
   * @returns {Object} - The standardized price object.
   */
  createPriceObject(price, currency, zipCode, amount) {
    return {
      provider: this.providerName,
      price: parseFloat(price),
      currency: currency,
      amount_liters: parseInt(amount, 10),
      zip_code: zipCode,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = BaseAdapter;
