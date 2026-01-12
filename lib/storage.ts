import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface Entry {
  id: string;
  title: string;
  content: string;
  url?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

class Storage {
  private getFilePath(type: string): string {
    return path.join(DATA_DIR, `${type}.json`);
  }

  private readData(type: string): Entry[] {
    const filePath = this.getFilePath(type);
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  }

  private writeData(type: string, data: Entry[]): void {
    const filePath = this.getFilePath(type);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  getAll(type: string): Entry[] {
    return this.readData(type);
  }

  getById(type: string, id: string): Entry | undefined {
    const data = this.readData(type);
    return data.find(entry => entry.id === id);
  }

  create(type: string, entry: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>): Entry {
    const data = this.readData(type);
    const now = new Date().toISOString();
    const newEntry: Entry = {
      ...entry,
      id: Date.now().toString(),
      createdAt: now,
      updatedAt: now,
    };
    data.push(newEntry);
    this.writeData(type, data);
    return newEntry;
  }

  update(type: string, id: string, updates: Partial<Omit<Entry, 'id' | 'createdAt'>>): Entry | null {
    const data = this.readData(type);
    const index = data.findIndex(entry => entry.id === id);
    if (index === -1) return null;
    
    data[index] = {
      ...data[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.writeData(type, data);
    return data[index];
  }

  delete(type: string, id: string): boolean {
    const data = this.readData(type);
    const filteredData = data.filter(entry => entry.id !== id);
    if (filteredData.length === data.length) return false;
    
    this.writeData(type, filteredData);
    return true;
  }
}

export const storage = new Storage();
