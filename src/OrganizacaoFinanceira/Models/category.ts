export interface Category {
  id: number;
  name: string;
  type: 1 | 2;
  color: string;
  icon: string | null;
}

export interface CategoryInput {
  name: string;
  type: 1 | 2;
  color: string;
  icon: string | null;
}
