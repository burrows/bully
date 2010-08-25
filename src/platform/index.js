if (typeof process === 'object') {
  require('./node');
}
else if (typeof window === 'object') {
  require('./browser');
}
else {
  throw "unknown platform";
}

