# Node libraries
MOUT = require 'mout'
ES = require 'event-stream'
VFS = require 'vinyl-fs'

# ngbp
ngbp = require './../ngbp'

# Flows currently registered
flows = {}

# Tasks during which flows would like to run.
definedTasks = []

# Priority range
minPriority = 1
maxPriority = 100

class Flow
  constructor: ( @name, @patterns, @options ) ->

    if not @patterns?.length? or @patterns.length <= 0
      throw new Error "Flow '#{@name}' has no globs. It must have at least one globbing pattern."

    @deps = []
    @steps = []
    @usedPriorities = []

    @options.tasks ?= []
    @options.tasks = [ @options.tasks ] if ngbp.util.typeOf( @options.tasks ) isnt 'Array'

  add: ( name, priority, fn ) ->
    if @usedPriorities.indexOf( priority ) isnt -1
      ngbp.log.warning "Error loading stream '#{name}': multiple tasks in '#{@name}' flow are set to run at #{priority}. There is no guarantee which will run first."
    else
      @usedPriorities.push priority

    @steps.push
      name: name
      priority: priority
      run: fn

    ngbp.debug.log "Added step #{name} to flow #{@name}."
    this

  addMerge: ( flow, priority ) ->
    @deps.push flow.getTaskName()
    @add "merge::#{flow.name}", priority, () ->
      ES.merge @stream, flow.stream
    this
      
  watch: ( priority, fn ) ->
    # what to do here?
    this

  run: ( callback ) ->
    steps = @steps.sort UTIL.sortByPriority
    @stream = VFS.src @pattern

    @steps.forEach ( step ) ->
      ngbp.verbose.log "Piping to stream #{step.name} in flow #{@name}."
      @stream.pipe( step.run ) if shouldRun step

    if @options.dest?
      @stream.pipe VFS.dest( @options.dest )

    @stream.pipe ES.wait( callback )

  getTaskName: () ->
    "flow::#{@name}"

  getDependencies: () ->
    @deps

module.exports = flow = ( name, globs, options ) ->
  if flows[ name ]?
    if globs? or options?
      ngbp.verbose.log "The flow '#{name}' already exists. I'll just merge their globs and options."
      ngbp.fatal "The flow '#{name}' already exists. Merging not yet implemented."
      # TODO: gotsta merge, baby!
  else
    flows[ name ] = new Flow( name, globs, options )

  flows[ name ]

###
# Get all defined flows.
###
flow.all = () ->
  MOUT.object.values flows

