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
  constructor: ( @name, @options ) ->

    if not @options.source?
      throw new Error "Flow '#{@name}' has no source. It can't do anything if it starts with nothing."

    if ngbp.util.typeOf( @options.source ) is 'String'
      @options.source = [ @options.source ]

    if not ngbp.util.isFunction( @options.source ) and not ngbp.util.isArray( @options.source )
      throw new Error "Invalid source for flow '#{@name}'; expected String, Array, or Function."

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

    # Create the stream by either calling the provided function or reading files from disk.
    if ngbp.util.isFunction @options.source
      @stream = @options.source()

      # TODO(jdm): This is completely untested!
      if ngbp.util.isA @stream, "Stream"
        ngbp.fatal "The source function for flow '#{@name}' did not return a stream."
    else
      @stream = VFS.src @options.source

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

module.exports = flow = ( name, options ) ->
  if flows[ name ]?
    if options?
      ngbp.fatal "The flow '#{name}' already exists."
      # TODO(jdm): Add ability to merge or re-define an existing stream.
  else
    flows[ name ] = new Flow( name, options )

  flows[ name ]

###
# Get all defined flows.
###
flow.all = () ->
  MOUT.object.values flows

