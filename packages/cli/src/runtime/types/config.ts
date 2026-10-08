import type { PortableStemConfig } from '@stemdev/core';

export interface ResolvedStemConfig extends PortableStemConfig {
  projectRoot: string;
}
