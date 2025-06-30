

class OptimizedService<T> {
  private cache = new Map<string, { data: T | T[]; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

  protected async fetchWithCache(
    key: string,
    query: () => Promise<any> // Query pode retornar um objeto ou um array
  ): Promise<any> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      console.log(`Cache hit para a chave: ${key}`);
      return cached.data;
    }

    console.log(`Buscando dados frescos para a chave: ${key}`);
    const data = await query();
    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  public clearCache(key?: string) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}

export default OptimizedService;