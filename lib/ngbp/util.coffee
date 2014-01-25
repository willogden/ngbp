# Node modules
EXIT = require 'exit'
FS = require 'fs'
Q = require 'q'
TPL = require 'lodash.template'
GLOB = require 'glob'
GS = require 'glob-stream'
ES = require 'event-stream'
ASYNC = require 'async'

# ngbp libraries
CONFIG = require './config'

# The exported module.
util = module.exports = {}

# This fixes a Windows problem with truncating output when using process.exit
# See https://github.com/cowboy/node-exit
util.exit = EXIT

# Convenience method for creating deferreds.
util.q = Q
util.defer = Q.defer
util.promise = ( fn ) ->
  deferred = Q.defer()
  fn deferred
  return deferred.promise

# Asynchronous Methods
util.each = ASYNC.each

# Filesystem wrappers
util.readFile = Q.denodeify FS.readFile
util.writeFile = Q.denodeify FS.writeFile
util.pathExists = Q.denodeify FS.exists
util.readFileSync = FS.readFileSync
util.writeFileSync = FS.writeFileSync
util.pathExistsSync = FS.existsSync

# Globbing
util.glob = Q.denodeify GLOB
util.globStream = GS.create

# Streams
util.toStream = ES.map

# JSON
util.parseJsonSync = JSON.parse
util.parseJson = ( string ) ->
  Q.try () ->
    JSON.parse string

util.stringifyJson = ( obj, pretty ) ->
  Q.try () ->
    if pretty then JSON.stringify( obj, null, " " ) else JSON.stringify( obj )

# Determining variables types
classMap =
  "[object Number]": "Number"
  "[object String]": "String"
  "[object Boolean]": "Boolean"
  "[object Function]": "Function"
  "[object RegExp]": "RegExp"
  "[object Array]": "Array"
  "[object Date]": "Date"
  "[object Error]": "Error"

# Match "[object ___]" where "___" is a [[Class]] value.
className = /^\[object (.*)\]$/

# Return a specific useful value based on a passed object's [[Class]].
# Based on https://github.com/cowboy/javascript-getclass
util.typeOf = ( value ) ->
  if value is null
    return "Null"
  else if not value?
    return "Undefined"

  # Get the "[object [[Class]]]" string for the passed value.
  key = classMap.toString.call(value)

  if classMap.hasOwnProperty key
    # If the key exists in classMap, return its [[Class]].
    return classMap[ key ]
  else
    # If not in "specific" mode or key doesn't match pattern, just return
    # the more generic "Object".
    "Object"

util.isArray = ( value ) ->
  if util.typeOf( value ) is "Array" then true else false

# Execute a function for every non-object property, recursing into objects and arrays.
# This is a direct port of grunt.util.recurse
util.forEveryProperty = ( value, fn, fnContinue ) ->
  if fnContinue? and fnContinue( value ) is false
    # Skip value if necessary.
    value
  else if util.isArray value
    # If value is an array, recurse.
    return value.map ( value ) ->
      return util.forEveryProperty value, fn, fnContinue
  else if util.kindOf( value ) is 'Object'
    # If value is an object, recurse.
    obj = {}
    MOUT.forOwn value, forEach ( val, key ) ->
      obj[ key ] = recurse val, fn, fnContinue

    return obj
  else
    # Otherwise pass value into fn and return.
    return fn value

# Process a template relative to the ngbp configuration, if needed.
util.template = ( tpl, data ) ->
  data = CONFIG() if not data?
  TPL tpl, data

