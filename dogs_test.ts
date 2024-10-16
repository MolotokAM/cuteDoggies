/* 
На мой взгляд, этот код решает все проблемы и значительно улучшает качество, безопасность и поддерживаемость кода.
Мои основные изменения и улучшения:
1. Безопасность: Теперь токен Яндекс.Диска берется из переменных окружения.
2. Добавлена обработка ошибок для всех асинхронных операций.
3. Использованы интерфейсы для улучшения типизации.
4. Асинхронность: Использованы async/await вместо цепочек промисов для улучшения читаемости.
5. Код разделен на логические классы и функции.
6. Улучшены имена функций и переменных для большей ясности и удобства наименования
7. Для повторного использования создан класс DogApi для работы с API собак.
8. Базовые URL вынесены в константы.
9. Добавлено более информативное логирование.
10. Код теперь легче тестировать и расширять.
*/

import axios, { AxiosError } from 'axios';

interface DogApiResponse {
  message: string | string[];
  status: string;
}

interface YandexDiskItem {
  type: string;
  name: string;
}

interface YandexDiskResponse {
  _embedded?: {
    items: YandexDiskItem[];
  };
}

class YaUploader {
  private readonly baseUrl = 'https://cloud-api.yandex.net/v1/disk';
  private readonly headers: Record<string, string>;

  constructor(private readonly token: string) {
    this.headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `OAuth ${this.token}`,
    };
  }

  async createFolder(path: string): Promise<void> {
    try {
      await axios.put(`${this.baseUrl}/resources?path=${path}`, {}, { headers: this.headers });
      console.log("Папка создана");
    } catch (error) {
      this.handleError(error, "Ошибка при создании папки");
    }
  }

  async uploadPhoto(path: string, urlFile: string, name: string): Promise<void> {
    try {
      const params = {
        path: `/${path}/${name}`,
        url: urlFile,
        overwrite: "true"
      };
      await axios.post(`${this.baseUrl}/resources/upload`, {}, { headers: this.headers, params });
      console.log(`Загружено: ${name}`);
    } catch (error) {
      this.handleError(error, "Ошибка при загрузке фото");
    }
  }

  private handleError(error: unknown, message: string): void {
    if (axios.isAxiosError(error)) {
      console.error(`${message}: ${error.message}`);
    } else {
      console.error(`${message}: Неизвестная ошибка`);
    }
  }
}

class DogApi {
  private readonly baseUrl = 'https://dog.ceo/api';

  async getSubBreeds(breed: string): Promise<string[]> {
    try {
      const response = await axios.get<DogApiResponse>(`${this.baseUrl}/breed/${breed}/list`);
      return Array.isArray(response.data.message) ? response.data.message : [];
    } catch (error) {
      this.handleError(error, "Ошибка при получении подпород");
      return [];
    }
  }

  async getRandomImage(breed: string, subBreed?: string): Promise<string> {
    try {
      const breedPath = subBreed ? `${breed}/${subBreed}` : breed;
      const response = await axios.get<DogApiResponse>(`${this.baseUrl}/breed/${breedPath}/images/random`);
      return typeof response.data.message === 'string' ? response.data.message : '';
    } catch (error) {
      this.handleError(error, "Ошибка при получении случайного изображения");
      return '';
    }
  }

  private handleError(error: unknown, message: string): void {
    if (axios.isAxiosError(error)) {
      console.error(`${message}: ${error.message}`);
    } else {
      console.error(`${message}: Неизвестная ошибка`);
    }
  }
}

async function uploadDogImages(breed: string, token: string): Promise<void> {
  const dogApi = new DogApi();
  const yaUploader = new YaUploader(token);
  const folderName = 'dog_images';

  await yaUploader.createFolder(folderName);

  const subBreeds = await dogApi.getSubBreeds(breed);

  if (subBreeds.length > 0) {
    for (const subBreed of subBreeds) {
      const imageUrl = await dogApi.getRandomImage(breed, subBreed);
      if (imageUrl) {
        await yaUploader.uploadPhoto(folderName, imageUrl, `${breed}_${subBreed}.jpg`);
      }
    }
  } else {
    const imageUrl = await dogApi.getRandomImage(breed);
    if (imageUrl) {
      await yaUploader.uploadPhoto(folderName, imageUrl, `${breed}.jpg`);
    }
  }
}

async function checkUploadedFiles(token: string): Promise<void> {
  try {
    const response = await axios.get<YandexDiskResponse>('https://cloud-api.yandex.net/v1/disk/resources', {
      params: { path: '/dog_images' },
      headers: { Authorization: `OAuth ${token}` }
    });

    const items = response.data._embedded?.items || [];
    items.forEach(item => {
      if (item.type === 'file') {
        console.log(`Найден файл: ${item.name}`);
      }
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`Ошибка при проверке загруженных файлов: ${error.message}`);
    } else {
      console.error("Неизвестная ошибка при проверке загруженных файлов");
    }
  }
}

async function main() {
  const breeds = ['doberman', 'bulldog', 'collie'];
  const randomBreed = breeds[Math.floor(Math.random() * breeds.length)];
  const token = process.env.YANDEX_DISK_TOKEN;

  if (!token) {
    console.error("Токен Яндекс.Диска не найден в переменных окружения");
    return;
  }

  await uploadDogImages(randomBreed, token);
  await checkUploadedFiles(token);
}

main().catch(error => console.error("Произошла ошибка:", error));
