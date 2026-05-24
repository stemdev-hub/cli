// TODO: Define tag schema contracts loaded from blocks/schemas/*.yaml.
export interface TagSchema {
  name: string;
  required: string[];
  description?: string;
}
