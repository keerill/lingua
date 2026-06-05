import { Mistake } from '../mistake';

export const MISTAKE_DETECTOR = Symbol('MistakeDetector');

export interface MistakeDetector {
  detect(userText: string): Mistake[];
}
