
export interface Point {
  x: number;
  y: number;
}

export interface Overlay {
  id: string;
  image: HTMLImageElement;
  x: number;
  y: number;
  scale: number;
  name: string;
}

export interface DocumentAnalysis {
  suggestedPlacements: Point[];
  description: string;
}
