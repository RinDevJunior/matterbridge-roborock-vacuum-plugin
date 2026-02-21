const token = '%[a-f0-9]{2}';
const singleMatcher = new RegExp('(' + token + ')|([^%]+?)', 'gi');
const multiMatcher = new RegExp('(' + token + ')+', 'gi');

function decodeComponents(
  components: RegExpMatchArray | string[] | [],
  split: number | undefined = undefined,
): string[] {
  try {
    return [decodeURIComponent(components.join(''))];
  } catch {
    // Do nothing
  }

  if (components.length === 1) {
    return components;
  }

  split = split ?? 1;
  const left = components.slice(0, split);
  const right = components.slice(split);
  return Array.prototype.concat.call([], decodeComponents(left), decodeComponents(right));
}

function decode(input: string) {
  try {
    return decodeURIComponent(input);
  } catch {
    let tokens = input.match(singleMatcher) ?? [];

    for (let i = 1; i < tokens.length; i++) {
      input = decodeComponents(tokens, i).join('');

      tokens = input.match(singleMatcher) ?? [];
    }

    return input;
  }
}

function customDecodeURIComponent(input: string): string {
  const replaceMap: Record<string, string> = {
    '%FE%FF': '\uFFFD\uFFFD',
    '%FF%FE': '\uFFFD\uFFFD',
  };

  let match = multiMatcher.exec(input);
  while (match) {
    try {
      replaceMap[match[0]] = decodeURIComponent(match[0]);
    } catch {
      const result = decode(match[0]);

      if (result !== match[0]) {
        replaceMap[match[0]] = result;
      }
    }

    match = multiMatcher.exec(input);
  }
  replaceMap['%C2'] = '\uFFFD';

  const entries = Object.keys(replaceMap);

  for (const key of entries) {
    input = input.replace(new RegExp(key, 'g'), replaceMap[key]);
  }

  return input;
}

export default function decodeComponent(encodedURI: string | undefined) {
  if (encodedURI === undefined) {
    return undefined;
  }
  try {
    return decodeURIComponent(encodedURI);
  } catch {
    return customDecodeURIComponent(encodedURI);
  }
}
