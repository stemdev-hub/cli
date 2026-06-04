import type { ParsedBlock, StemTag, TagSchema, ValidationIssue } from '@stem/types';

export function validateSchemas(blocks: ParsedBlock[], schemas: Map<string, TagSchema>): ValidationIssue[] {
  if (schemas.size === 0) {
    return [];
  }

  return blocks.flatMap((block) => validateBlockSchemas(block, schemas));
}

function validateBlockSchemas(block: ParsedBlock, schemas: Map<string, TagSchema>): ValidationIssue[] {
  const sectionTags = block.sections.flatMap((section) => [...section.tags, ...section.externalTags]);
  const allTags = [...sectionTags, ...block.standaloneTags];

  return allTags.flatMap((tag) => validateTagSchema(block, tag, schemas));
}

function validateTagSchema(block: ParsedBlock, tag: StemTag, schemas: Map<string, TagSchema>): ValidationIssue[] {
  const schema = schemas.get(tag.name);

  if (schema === undefined) {
    return [];
  }

  const missingSections = schema.required.filter((requiredSection) => !tag.content.includes(requiredSection));
  if (missingSections.length === 0) {
    return [];
  }

  return [
    {
      code: 'SCHEMA_VIOLATION',
      severity: 'error',
      message: `Tag "${tag.name}" is missing required schema sections: ${missingSections.join(', ')}.`,
      filePath: block.filePath,
      relativePath: block.relativePath,
      position: tag.position,
      context: {
        tagName: tag.name,
        missingSections: missingSections.join(', ')
      }
    }
  ];
}
