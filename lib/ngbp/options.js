var data = {};

var options = module.exports = function ( key, value ) {
  if ( arguments.length === 2 ) {
    data[ key ] = value;
    return data[ key ];
  } else {
    return data[ key ];
  }
};

options.init = function ( o ) {
  data = o || {};
  return data;
};

options._raw = function () {
  return data;
};

