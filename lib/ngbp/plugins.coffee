# Node libraries
PATH = require 'path'

# ngbp libraries
ngbp = require './../ngbp'

plugins = module.exports = {}

pluginRegistry = []

plugins.load = () ->
  plugins.loadNpmPlugins()
###
  .then () ->
    ngbp.config( 'plugins' )?.forEach ( plugin ) ->
      # TODO(jdm): implement this
      plugins.loadPlugins plugin
###

plugins.loadPlugins = ( plugin_dir ) ->
  ngbp.verbose.log "Loading plugin #{plugin_dir}..."

  if pluginRegistry.indexOf( plugin_dir ) isnt -1
    ngbp.log.warn "#{plugin_dir} has already been loaded. Skipping it for now."
    ngbp.util.q true
  else if not ngbp.util.pathExistsSync plugin_dir
    ngbp.log.fatal "Plugin directory #{plugin_dir} doesn't exist."
  else
    ngbp.util.glob( PATH.join( plugin_dir, '*.{js,coffee}' ) )
    .then ( files ) ->
      ngbp.util.promise ( deferred ) ->
        ngbp.util.each files, ( file, callback ) ->
          fn = require file

          if ngbp.util.typeOf( fn ) is 'Function'
            fn.call NGBP, NGBP
          else
            ngbp.log.warn "#{plugin_dir} doesn't export a function."
        , ( err ) ->
          if err?
            deferred.reject err
          else
            deferred.resolve true

plugins.loadNpmPlugins = () ->
  modules_dir = PATH.resolve 'node_modules'

  # Stream all the package files
  ngbp.util.glob( PATH.join( modules_dir, '/*/package.json' ) )
  .then ( files ) ->
    ngbp.util.promise ( deferred ) ->
      ngbp.util.each files, ( file, callback ) ->
        contents = ngbp.util.readFileSync( file )
        pkg = ngbp.util.parseJsonSync( contents )
        if pkg?.keywords? and pkg.keywords.indexOf( 'ngbpplugin' ) isnt -1
          ngbp.verbose.log "Found ngbp plugin #{pkg.name}"
          # TODO(jdm): handle ngbpcollections
          
          plugins.loadPlugins( PATH.join( modules_dir, pkg.name, 'plugins' ) )
          .then () ->
            callback()
          , ( err ) ->
            callback err
      , ( err ) ->
        if err?
          deferred.reject err
        else
          deferred.resolve true

