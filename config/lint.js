var options = {
  adsafe     : false, // if ADsafe should be enforced
  bitwise    : false, // if bitwise operators should not be allowed
  browser    : false, // if the standard browser globals should be predefined
  cap        : false, // if upper case HTML should be allowed
  css        : false, // if CSS workarounds should be tolerated
  debug      : false, // if debugger statements should be allowed
  devel      : false, // if logging should be allowed (console, alert, etc.)
  eqeqeq     : true,  // if === should be required
  evil       : false, // if eval should be allowed
  forin      : true,  // if for in statements must filter
  fragment   : false, // if HTML fragments should be allowed
  immed      : true,  // if immediate invocations must be wrapped in parens
  laxbreak   : false, // if line breaks should not be checked
  newcap     : true,  // if constructor names must be capitalized
  nomen      : false, // if names should be checked
  on         : false, // if HTML event handlers should be allowed
  onevar     : true,  // if only one var statement per function should be allowed
  passfail   : false, // if the scan should stop on first error
  plusplus   : true,  // if increment/decrement should not be allowed
  regexp     : false, // if the . should not be allowed in regexp literals
  rhino      : false, // if the Rhino environment globals should be predefined
  undef      : true,  // if variables should be declared before used
  safe       : false, // if use of some browser features should be restricted
  sidebar    : false, // if the System object should be predefined
  strict     : false, // require the "use strict"; pragma
  sub        : false, // if all forms of subscript notation are tolerated
  white      : false, // if strict whitespace rules apply
  widget     : false, // if the Yahoo Widgets globals should be predefined
  indent     : 2,     // set the expected indentation level
  predef     : ['exports', 'module', 'require', 'process', '__filename',
                '__dirname', 'GLOBAL', 'global', 'Bully', 'window', 'console'],
  
  // customise the error reporting -- the following colours the text red
  error_prefix: "\u001b[1m",
  error_suffix: ":\u001b[0m "
};

