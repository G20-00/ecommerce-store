import { Product } from "@/types";
import qs from "query-string";
import { createClient } from "redis";
import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";

const keyVaultName = "passwordredisauto"; 
const keyVaultUrl = `https://${keyVaultName}.vault.azure.net`;

const credential = new DefaultAzureCredential();
const secretClient = new SecretClient(keyVaultUrl, credential);

async function getSecret(secretName: string): Promise<string> {
  try {
    const secret = await secretClient.getSecret(secretName);
    return secret.value || '';
  } catch (error) {
    console.error(`Error fetching secret ${secretName}:`, error);
    throw new Error(`Failed to fetch secret ${secretName}`);
  }
}

async function initializeSecrets() {
  try {
    const REDIS_URL = await getSecret("REDIS-URL");
    const REDIS_PASSWORD = await getSecret("REDIS-PASSWORD");
    const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || '';
    

    const redisClient = createClient({
      url: REDIS_URL,
      password: REDIS_PASSWORD,
    });

    redisClient.on("error", (err) => console.error("Redis Client Error", err));

    try {
      await redisClient.connect();
      console.log("Successfully connected to Redis");
    } catch (err) {
      console.error("Failed to connect to Redis:", err);
    }

    const URL = `${NEXT_PUBLIC_API_URL}/products`;

    interface Query extends Record<string, any> {
      categoryId?: string;
      colorId?: string;
      sizeId?: string;
      isFeatured?: boolean;
    }

    const getProducts = async (query: Query): Promise<Product[]> => {
      const queryString = qs.stringify({
        colorId: query.colorId,
        sizeId: query.sizeId,
        categoryId: query.categoryId,
        isFeatured: query.isFeatured,
      });
      const cacheKey = `products:${queryString}`;

      try {
        // Intentar obtener los datos desde Redis
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
          console.log("Data retrieved from Redis cache");
          return JSON.parse(cachedData);
        }

        // Si no están en Redis, hacer el llamado a la API
        const url = qs.stringifyUrl({ url: URL, query });
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error("Failed to fetch products");
        }
        const data = await res.json();

        // Almacenar los datos en Redis por 20 segundos
        await redisClient.set(cacheKey, JSON.stringify(data), {
          EX: 20,
        });

        console.log("Data retrieved from database");

        return data;
      } catch (error) {
        console.error("Error fetching products:", error);
        throw new Error("Failed to fetch products");
      }
    };

    return getProducts;
  } catch (error) {
    console.error("Error initializing secrets:", error);
    throw error;
  }
}

// Exportar la función getProducts usando initializeSecrets
const getProductsPromise = initializeSecrets();

export default async function getProducts(query: Record<string, any>) {
  const getProducts = await getProductsPromise;
  return getProducts(query);
}
