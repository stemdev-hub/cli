type ParsedMacro = {
  raw: string;
  type: string;
  identifier: string | null;
  section: string | null;
  tag: string | null;
  unknownParams: string[];
};

const stemPattern =
  /@stem\[(end|((?:block|section|tag|dep)):([A-Za-z0-9_-]+(?:#[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?)?)(?:\s+([^\]]+))?)\]/g;

const patterns = [
  '@stem[block:auth-flow-block]',
  '@stem[block:auth-flow-block section=auth-flow tag=summary]',
  '@stem[block:auth-flow-block section=auth-flow]',
  '@stem[block:auth-flow-block tag=summary]',
  '@stem[section:auth-flow]',
  '@stem[tag:summary]',
  '@stem[tag:summary section=auth-flow]',
  '@stem[dep:jwt-token-block]',
  '@stem[dep:jwt-token-block#jwt-token.api]',
  '@stem[end]'
];

const edgeCases = [
  '@stem[]',
  '@stem[invalid]',
  '@stem[unknown:id]',
  '@stem[block:id extra=value unknown=other]',
  '@stem[block:first] then @stem[tag:second]',
  '@stem[block:start] begins this line',
  'This line ends with @stem[block:end]',
  'A sentence with @stem[block:middle] in its middle.'
];

console.log('=== Required Grammar Patterns ===');
for (const sample of patterns) {
  printMatches(sample);
}

console.log('\n=== Edge Cases ===');
for (const sample of edgeCases) {
  printMatches(sample);
}

function printMatches(input: string): void {
  const parsed = parseMatches(input);
  console.log(`INPUT: ${input}`);
  console.log(`MATCHED: ${parsed.length > 0 ? 'yes' : 'no'}`);
  if (parsed.length === 0) {
    console.log('GROUPS: none');
  }
  for (const result of parsed) {
    console.log(`GROUPS: ${JSON.stringify(result)}`);
  }
}

function parseMatches(input: string): ParsedMacro[] {
  const results: ParsedMacro[] = [];
  stemPattern.lastIndex = 0;

  for (const match of input.matchAll(stemPattern)) {
    const raw = match[0];
    const head = match[1] ?? '';
    const type = head === 'end' ? 'end' : match[2] ?? '';
    const rawIdentifier = head === 'end' ? null : match[3] ?? null;
    const params = parseParams(match[4] ?? '');
    const scoped = type === 'dep' && rawIdentifier !== null ? parseScopedDependency(rawIdentifier) : null;

    results.push({
      raw,
      type,
      identifier: scoped?.blockId ?? rawIdentifier,
      section: scoped?.section ?? params.section,
      tag: scoped?.tag ?? params.tag,
      unknownParams: params.unknownParams
    });
  }

  return results;
}

function parseParams(rawParams: string): {
  section: string | null;
  tag: string | null;
  unknownParams: string[];
} {
  let section: string | null = null;
  let tag: string | null = null;
  const unknownParams: string[] = [];

  for (const parameter of rawParams.split(/\s+/).filter(Boolean)) {
    const [key, value] = parameter.split('=', 2);
    if (key === 'section' && value !== undefined) {
      section = value;
    } else if (key === 'tag' && value !== undefined) {
      tag = value;
    } else {
      unknownParams.push(parameter);
    }
  }

  return { section, tag, unknownParams };
}

function parseScopedDependency(identifier: string): {
  blockId: string;
  section: string | null;
  tag: string | null;
} {
  const [blockId = '', scope] = identifier.split('#', 2);
  const [section, tag] = scope?.split('.', 2) ?? [];
  return {
    blockId,
    section: section ?? null,
    tag: tag ?? null
  };
}
