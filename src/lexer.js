
Bully.Lexer = function() {};

Bully.Lexer.KEYWORDS = [
  'def',
  'do',
  'class',
  'end',
  'true',
  'false',
  'nil',
  'self',
  'return',
  'if',
  'unless',
  'else',
  'elsif',
  'then',
  'begin',
  'rescue',
  'ensure',
  'super',
  'yield'
];

Bully.Lexer.OPERATORS = [
  '===',
  '==',
  '!=',
  '<<',
  '>>',
  '&&',
  '||',
  '=>',
  '>',
  '<',
  '+',
  '-',
  '*',
  '/',
  '%',
  '&',
  '!',
  '~'
];

Bully.Lexer.regex_escape = function(text) {
  return text.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&");
};

Bully.Lexer.prototype = {
  tokenize: function(code) {
    var pos     = 0,  // current character position
        tokens  = [], // list of the parsed tokens, form is: [tag, value, lineno]
        line    = 1,  // the current source line number
        opRegex = [],
        chunk, match, i;

    for (i = 0; i < Bully.Lexer.OPERATORS.length; i += 1) {
      opRegex.push(Bully.Lexer.regex_escape(Bully.Lexer.OPERATORS[i]));
    }

    opRegex = new RegExp('^(' + opRegex.join('|') + ')');

    while (pos < code.length) {
      chunk = code.substr(pos);

      // match standard tokens
      if ((match = chunk.match(/^([a-z_]\w*[?!]?)/))) {
        match = match[1];
        if (Bully.Lexer.KEYWORDS.indexOf(match) !== -1) {
          tokens.push([match.toUpperCase(), match, line]);
        }
        else {
          tokens.push(['IDENTIFIER', match, line]);
        }

        pos += match.length;
      }
      // match symbols
      else if ((match = chunk.match(/^(:[a-zA-Z_]\w*)/))) {
        match = match[1];
        tokens.push(['SYMBOL', match, line]);
        pos += match.length;
      }
      // match operators
      else if ((match = chunk.match(opRegex))) {
        match = match[1];
        tokens.push([match, match, line]);
        pos += match.length;
      }
      // match constants
      else if ((match = chunk.match(/^([A-Z]\w*)/))) {
        match = match[1];
        tokens.push(['CONSTANT', match, line]);
        pos += match.length;
      }
      else if ((match = chunk.match(/^([0-9]+)/))) {
        match = match[1];
        tokens.push(['NUMBER', parseInt(match, 10), line]);
        pos += match.length;
      }
      // double quoted strings
      else if ((match = chunk.match(/^"([^"\\]*(\\.[^"\\]*)*)"/))) {
        match = match[1];
        tokens.push(['STRING', match, line]);
        pos += match.length + 2;
      }
      // single quoted strings
      else if ((match = chunk.match(/^'([^'\\]*(\\.[^'\\]*)*)'/))) {
        match = match[1];
        tokens.push(['STRING', match, line]);
        pos += match.length + 2;
      }
      // handle new lines
      else if ((match = chunk.match(/^\n/))) {
        tokens.push(["NEWLINE", "\n", line]);
        line += 1;
        pos += 1;
      }
      // ignore whitespace
      else if (chunk.match(/^ /)) {
        pos += 1;
      }
      // ignore comments
      else if ((match = chunk.match(/^#.*$/m))) {
        pos += match[0].length + 1;
      }
      // treat all other single characters as a token
      else {
        match = chunk.substring(0, 1);
        tokens.push([match, match, line]);
        pos += 1;
      }
    }

    return (new Bully.Rewriter(tokens)).rewrite();
  }
};

