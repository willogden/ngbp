# node libs
MOUT = require 'mout'
Q = require 'q'
FS = require 'fs'
FINDUP = require 'findup-sync'
MERGE = require 'deepmerge'

###
# Default ngbp options
###
_defaultConfig = {
  paths: {
    # The top-level directory where all built files are stored
    build: 'build',
    # The top-level directory where all compiled files are stored
    compile: 'bin',

    # The top-level directory where source files are kept pre-build
    source: 'src',
    # The top-level directory where vendor files are kept pre-build
    vendor: 'vendor',

    # Where source styles are kept pre-build
    source_styles: '<%= ngbp.paths.source %>/styles',

    # Where source assets are kept
    source_assets: '<%= ngbp.paths.source %>/assets',
    # Where assets are stored after the build
    build_assets: '<%= ngbp.paths.build %>/assets',
    # Where assets are finnaly put after the compile
    compile_assets: '<%= ngbp.paths.compile %>/assets',

    # Where scripts are stored after the build
    build_js: '<%= ngbp.paths.build %>/scripts',
    # Where scripts are finally stored after the compile
    build_css: '<%= ngbp.paths.build %>/styles',
  },

  # The final resting place of processed and compiled targets.
  targets: {
    compile: {
      js: '<%= ngbp.paths.compile_assets %>/<%= pkg.name %>-<%= pkg.version %>.min.js',
      css: '<%= ngbp.paths.compile_assets %>/<%= pkg.name %>-<%= pkg.version %>.min.css',
      html: '<%= ngbp.paths.compile %>/index.html'
    },

    build: {
      html: '<%= ngbp.paths.build %>/index.html'
    }
  },

  # Default file patterns for use by ngbp modules
  globs: {
    app: {
      js: [
        '<%= ngbp.paths.source %>###/*.js',
        '!<%= ngbp.paths.source %>###/*.spec.js',
        '!<%= ngbp.paths.source_assets %>###/*'
      ],
      jsunit: [
        '<%= ngbp.paths.source %>###/*.spec.js',
        '!<%= ngbp.paths.source_assets %>###/*'
      ],
      html: [
        '<%= ngbp.paths.source %>###/*.html',
        '!<%= ngbp.paths.source %>###/*.partial.html',
        '!<%= ngbp.paths.source %>###/*.tpl.html',
        '!<%= ngbp.paths.source_assets %>###/*'
      ],
      css: [
        '<%= ngbp.paths.source_styles %>###/*.css'
      ],
      assets: [
        '<%= ngbp.paths.source_assets %>###/*'
      ]
    },
    vendor: {
      js: [],
      jsunit: [],
      html: [],
      css: [],
      assets: []
    },
    build: {
      scripts: '<%= ngbp.paths.build_js %>###/*.js',
      styles: '<%= ngbp.paths.build_css %>###/*.css'
    }
  },

  banners: {
    js: {
      min: '' +
        '###\n' +
        ' * <%= pkg.name %> - v<%= pkg.version %> - <%= grunt.template.today("yyyy-mm-dd") %>\n' +
        ' * <%= pkg.homepage %>\n' +
        ' *\n' +
        ' * Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author %>\n' +
        ' * Licensed <%= pkg.licenses.type %> <<%= pkg.licenses.url %>>\n' +
        '###\n'
    },
    css: {
      min: '' +
        '###\n' +
        ' * <%= pkg.name %> - v<%= pkg.version %> - <%= grunt.template.today("yyyy-mm-dd") %>\n' +
        ' * <%= pkg.homepage %>\n' +
        ' *\n' +
        ' * Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author %>\n' +
        ' * Licensed <%= pkg.licenses.type %> <<%= pkg.licenses.url %>>\n' +
        '###\n'
    }
  },

  prevent: [],
  inject: []
}

###
# The current ngbp-wide configuration.
###
_config = {}

config = module.exports = ( key, val, merge ) ->
  if key
    if val
      if merge
        merge = {}
        MOUT.object.set merge, key, val
        config.merge merge
      else
        MOUT.object.set _config, key, val

    return config.process MOUT.object.get( _config, key )
  else
    return config.process MOUT.object.merge( {}, _config )

###
# Get the user-defined ngbp configuration.
###
config.init = ( user ) ->
  _userConfig = user
  _config = MOUT.object.merge _defaultConfig, user || {}

###
# Process every property of an object recursively as a template.
# Ripped from Grunt nearly directly.
###
config.process = ( obj ) ->
  # recurse will call the given for every non-object, non-array property of the given
  # object, however deep it has to go to do it.
  UTIL.forEveryProperty obj, ( value ) ->
    # We cannot process a non-string value (e.g. a number or a stream or whatnot) as a template, so
    # just return it.
    if UTIL.typeOf( value ) is 'String'
      return value

    # If possible, access the specified property via config.get, in case it
    # doesn't refer to a string, but instead refers to an object or array.
    matches = value.match /^<%=\s*([a-z0-9_$]+(?:\.[a-z0-9_$]+)*)\s*%>$/i
    if matches
      result = config.get matches[ 1 ]

      # If the result retrieved from the config data wasn't null or undefined,
      # return it.
      if result?
        return result

    # Process the string as a template.
    return UTIL.template value

###
# Merge a config object into the current configuration.
###
config.merge = ( conf ) ->
  _config = MERGE _config, conf

config.set = ( key, val ) ->
  MOUT.object.set _config, key, val

config.get = ( key ) ->
  config.process MOUT.object.get( _config, key )

config.getRaw = ( key ) ->
  if key
    MOUT.object.get _config, key
  else
    MOUT.object.merge {}, _config

###
# The user's configuration, containing only those variables set of manipulated by the user. All of
# these are also in _config, but this is what should be synchronized to ngbp.json.
###
_userConfig = {}

config.user = ( key, val, merge ) ->
  if key
    if val
      if merge
        merge = {}
        MOUT.object.set merge, key, val
        config.merge merge
      else
        MOUT.object.set _config, key, val

      # Regardless of whether it's a merge, we still need to sync the changes.
      _syncUserChanges()

    return config.process MOUT.object.get( _config, key )
  else
    return config.process MOUT.object.merge( {}, _config )

###
# Everything that needs to be done once the configuration is changed. e.g. sync with grunt.
###
_syncUserChanges = () ->
  _config = MOUT.object.merge _config, _userConfig

config.user.get = ( key ) ->
  config.process MOUT.object.get( _userConfig, key )

config.user.getRaw = ( key ) ->
  MOUT.object.get _userConfig, key

###
# Merge a config object into the user configuration.
###
config.user.merge = ( conf ) ->
  _userConfig = MERGE _userConfig, conf
  config.merge _userConfig
  _syncUserChanges()

###
# Set a configuration item on the user's configuration.
###
config.user.set = ( key, val ) ->
  MOUT.object.set _userConfig, key, val
  MOUT.object.set _config, key, val
  _syncUserChanges()

###
# Write the user configuration to file or, if requested, the entire ngbp configuration.
###
config.write = ( includeSystem ) ->
  if includeSystem
    conf = _config
  else
    conf = _userConfig

  UTIL.stringifyJson conf, true
  .then ( json ) ->
    # write to ngbp.json
    return UTIL.writeFile OPTIONS( 'configPath' ), contents
  , ( err ) ->
    LOG.fatal "Could not stringify JSON for config: #{err.toString()}"

