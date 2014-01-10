var Q = require( 'q' );
var FS = require( 'fs' );
var PATH = require( 'path' );
var MKDIRP = require( 'mkdirp' );
var MOUT = require( 'mout' );

var writeFile = Q.denodeify( FS.writeFile );
var readFile = Q.denodeify( FS.readFile );
var mkdirp = Q.denodeify( MKDIRP );

var scaffold = module.exports = {};

var defaultOptions = {
  prettifyJson: true,
  overwrite: true
};

function _getOptions ( opts ) {
  return MOUT.object.merge( defaultOptions, opts || {} );
}

function _write ( contents, destination, options ) {
  var directory = PATH.dirname( destination );

  // Create the directory, just in case
  return mkdirp( directory )
  .then( function () {
    // TODO: if no overwrite, check if file exists

    // Write out file
    return writeFile( destination, contents );
  });
}

scaffold.toJson = function toJson ( obj, destination, opts ) {
  var options = _getOptions( opts );
  return _write(
    JSON.stringify( obj, null, ( options.prettifyJson ? " " : undefined ) ),
    destination,
    options
  );
};

scaffold.write = function write ( contents, destination, opts ) {
  var options = _getOptions( opts );
  return _write( contents, destination, opts );
};

scaffold.copy = function copy ( source, destination, opts ) {
  var options = _getOptions( opts );
  return readFile( source )
  .then( function ( contents ) {
    // TODO: add template processing
    return _write( contents, destination, options );
  });
};

