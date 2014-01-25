# node modules
COLORS = require 'colors'
MOUT = require 'mout'

# ngbp libraries
OPTIONS = require './options'
UTIL = require './util'

log = {}
prefix = true

# TODO(jdm): include timestamp
wrap = ( text, newline ) ->
  msg = ""
  msg += "\n" if newline
  msg += "[ngbp] " if prefix
  msg += text or ""
  msg

log.error = ( msg ) ->
  oldPrefix = prefix
  prefix = true
  console.log wrap( msg ).red
  prefix = oldPrefix

log.fatal = ( error, code ) ->
  if typeof error is 'object'
    log.error error.toString()

    if error.stack and ( OPTIONS.stack || OPTIONS.debug )
      console.error error.stack
  else
    log.error error

  # TODO(jdm): Should support more sophisticated and standard error codes
  UTIL.exit code || 1

log.warning = ( msg ) ->
  console.log wrap( msg ).yellow

log.header = ( msg ) ->
  console.log wrap( msg, true ).bold.underline.cyan

log.subheader = ( msg ) ->
  console.log wrap( msg, true ).bold.magenta

log.success = ( msg ) ->
  console.log wrap( msg ).bold.green

log.log = ( msg ) ->
  console.log wrap( msg )

log.writeln = ( msg ) ->
  console.log msg || ""

log.disablePrefix = () ->
  prefix = false

log.enablePrefix = () ->
  prefix = true

# Create verbose versions of the log functions.
# Totally ripped from Grunt.
log.verbose = {}
log.notverbose = {}

MOUT.object.forOwn log, ( val, key ) ->
  if UTIL.typeOf( val ) is 'Function'
    log.verbose[ key ] = () ->
      if OPTIONS.verbose
        val.apply log, arguments
      log.verbose

    log.notverbose[ key ] = () ->
      if ! OPTIONS.verbose
        val.apply log, arguments
      log.notverbose

# A way to switch between verbose and notverbose modes. For example, this will
# write 'foo' if verbose logging is enabled, otherwise write 'bar':
# verbose.write('foo').or.write('bar')
log.verbose.or = log.notverbose
log.notverbose.or = log.verbose

module.exports = log

