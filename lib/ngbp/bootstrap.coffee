# Node libraries
Q = require 'q'
FINDUP = require 'findup-sync'

# ngbo libraries
ngbp = require './../ngbp'

module.exports = ( options ) ->
  # Store the options provided for system-wide access
  ngbp.options.init options

  # Locate the configuration file and save its path for later use
  configPath = FINDUP ngbp.options( 'configPath' ), { cwd: process.cwd() }

  ngbp.util.readFile( configPath )
  .then ( file ) ->
    # Save the config file location for later use
    ngbp.options 'configFile', configPath

    # Parse its contents
    ngbp.util.parseJson file
  , ( err ) ->
    ngbp.log.fatal "Could not read config file: #{err.toString()}"
  .then ( config ) ->
    # Load the config into ngbp
    ngbp.config.init config

    # Load all the plugins
    ngbp.plugins.load()
  , ( err ) ->
    ngbp.log.fatal "Could not parse config file: #{err.toString()}"

