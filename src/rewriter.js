
Bully.Rewriter = function(tokens) {
  this.tokens = tokens;
  this.index  = 0;
  return this;
};

Bully.Rewriter.KEYWORDS_ALLOWED_AS_METHODS = [ 'CLASS' ];

Bully.Rewriter.prototype = {
  rewrite: function() {
    this.remove_extra_newlines();
    this.convert_keyword_method_calls();
    return this.tokens;
  },

  next: function() {
    var t = this.tokens[this.index];
    this.index += 1;
    return t;
  },

  peak: function() {
    return this.tokens[this.index];
  },

  reset: function() {
    this.index = 0;
  },

  remove_next_of_type: function(type) {
    while (this.tokens[this.index][0] === type) {
      this.tokens.splice(this.index, 1);
    }
  },

  remove_prev_of_type: function(type) {
    while (this.tokens[this.index - 2][0] === type) {
      this.tokens.splice(this.index - 2, 1);
      this.index -= 1;
    }
  },

  remove_extra_newlines: function() {
    var token;

    while ((token = this.next())) {
      if (token[0] === '{' || token[0] === '[') {
        this.remove_next_of_type('NEWLINE');
      }
      else if (token[0] === '}' || token[0] === ']') {
        this.remove_prev_of_type('NEWLINE');
      }
      else if (token[0] === ',') {
        this.remove_prev_of_type('NEWLINE');
        this.remove_next_of_type('NEWLINE');
      }
    }

    this.reset();
  },

  convert_keyword_method_calls: function() {
    var t1, t2;

    while ((t1 = this.next()) && (t2 = this.peak())) {
      if ((t1[0] === '.' || t1[0] === 'DEF') &&
          Bully.Rewriter.KEYWORDS_ALLOWED_AS_METHODS.indexOf(t2[0]) !== -1) {
        t2[0] = 'IDENTIFIER';
      }
    }
  }
};

