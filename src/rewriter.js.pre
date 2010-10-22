
Bully.Rewriter = function(tokens) {
  this.tokens = tokens;
  this.index  = -1;
  return this;
};

Bully.Rewriter.KEYWORDS_ALLOWED_AS_METHODS = [ 'CLASS' ];

Bully.Rewriter.prototype = {
  rewrite: function() {
    this.remove_extra_newlines();
    this.rewrite_keyword_method_calls();
    return this.tokens;
  },

  next: function() {
    this.index += 1;
    return this.tokens[this.index];
  },

  prev: function() {
    this.index -= 1;
    return this.tokens[this.index];
  },

  peak: function() {
    return this.tokens[this.index + 1];
  },

  reset: function() {
    this.index = -1;
  },

  insert_before: function(token) {
    this.tokens.splice(this.index, 0, token);
  },

  insert_after: function(token) {
    this.tokens.splice(this.index + 1, 0, token);
  },

  remove: function() {
    this.tokens.splice(this.index, 1);
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
        while ((token = this.next()) && token[0] === 'NEWLINE') { this.remove(); }
      }
      else if (token[0] === '}' || token[0] === ']') {
        while ((token = this.prev()) && token[0] === 'NEWLINE') { this.remove(); }
        this.next();
      }
      else if (token[0] === ',') {
        while ((token = this.prev()) && token[0] === 'NEWLINE') { this.remove(); }
        this.next();
        while ((token = this.next()) && token[0] === 'NEWLINE') { this.remove(); }
      }
    }

    this.reset();
  },

  rewrite_keyword_method_calls: function() {
    var t1, t2;

    while ((t1 = this.next()) && (t2 = this.peak())) {
      if ((t1[0] === '.' || t1[0] === 'DEF') &&
          Bully.Rewriter.KEYWORDS_ALLOWED_AS_METHODS.indexOf(t2[0]) !== -1) {
        t2[0] = 'IDENTIFIER';
      }
    }

    this.reset();
  }
};

