export interface Gateway {
  getStock(sku: string): Promise<unknown>;
  getSalesHistory(sku: string): Promise<unknown>;
  getNeed(sku: string): Promise<unknown>;
  listOffers(sku: string): Promise<unknown>;
}

export class UnavailableGateway implements Gateway {
  private unavailable(): never {
    throw new Error("GATEWAY_NOT_CONFIGURED");
  }

  async getStock(): Promise<unknown> { return this.unavailable(); }
  async getSalesHistory(): Promise<unknown> { return this.unavailable(); }
  async getNeed(): Promise<unknown> { return this.unavailable(); }
  async listOffers(): Promise<unknown> { return this.unavailable(); }
}
