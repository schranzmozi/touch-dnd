(function($) {
  var START_EVENT = 'mousedown touchstart MSPointerDown pointerdown'
    , END_EVENT   = 'mouseup touchend MSPointerUp pointerup'
    , MOVE_EVENT  = 'mousemove touchmove MSPointerMove pointermove scroll'

  function translate(el, x, y) {
    vendorify('transform', el, 'translate(' + x + 'px, ' + y + 'px)')
  }

  function transition(el, val) {
    vendorify('transition', el, val)
  }

  function getTouchPageX(e) {
    return window.event && window.event.changedTouches && event.changedTouches[0].pageX || e.pageX
  }

  function getTouchPageY(e) {
    return window.event && window.event.changedTouches && event.changedTouches[0].pageY || e.pageY
  }

  function vendorify(property, el, val) {
    property = property.toLowerCase()
    var titleCased = property.charAt(0).toUpperCase() + property.substr(1)
    var vendorPrefixes = ['webkit', 'Moz', 'ms', 'O']
    var properties = vendorPrefixes.map(function(prefix) {
      return prefix + titleCased
    }).concat('transform')
    for (var i = 0, len = properties.length; i < len; ++i) {
      if (properties[i] in el.style) {
        if (val !== undefined) el.style[properties[i]] = val
        else return el.style[properties[i]]
        break
      }
    }
  }

  var eventProperties = [
    'altKey', 'bubbles', 'button', 'cancelable', 'charCode', 'clientX',
    'clientY', 'ctrlKey', 'currentTarget', 'data', 'detail', 'eventPhase',
    'metaKey', 'offsetX', 'offsetY', 'originalTarget', 'pageX', 'pageY',
    'relatedTarget', 'screenX', 'screenY', 'shiftKey', 'target', 'view',
    'which'
  ]
  function trigger(el, name, originalEvent, arg) {
    if (!el[0]) return

    originalEvent = originalEvent.originalEvent || originalEvent
    var props = {}
    eventProperties.forEach(function(prop) {
      props[prop] = originalEvent[prop]
    })
    props.currentTarget = props.target = el[0]

    var win = (el[0].ownerDocument.defaultView || el[0].ownerDocument.parentWindow)

    var e = win.$.Event(name, props)
    win.$(el[0]).trigger(e, arg)
    return e
  }

  var nextId = 0
  var Dragging = function() {
    this.eventHandler = $('<div />')
    this.parent = this.el = this.handle = null
    this.origin = { x: 0, y: 0, transition: null, translate: null, offset: { x: 0, y: 0 } }
    this.lastEntered = this.currentTarget = null
    this.lastX = this.lastY = this.lastDirection = null
    this.originalCss = {}
    this.windows = [window]

    var placeholder
    Object.defineProperty(this, 'placeholder', {
      get: function() { return placeholder },
      set: function(val) {
        if (placeholder === val) return
        if (placeholder) placeholder.remove()
        placeholder = val
      }
    })
  }

  Dragging.prototype.on = function() {
    this.eventHandler.on.apply(this.eventHandler, Array.prototype.slice.call(arguments))
    return this
  }

  Dragging.prototype.off = function() {
    this.eventHandler.off.apply(this.eventHandler, Array.prototype.slice.call(arguments))
    return this
  }

  Dragging.prototype.start = function(parent, el, e, handle) {
    this.parent = parent
    this.el = el
    this.handle = handle
    var el = this.handle || this.el
    el.css('-ms-touch-action', 'none').css('touch-action', 'none')
    this.origin.x = getTouchPageX(e)
    this.origin.y = getTouchPageY(e)
    this.origin.transform  = vendorify('transform', this.el[0])
    this.origin.transition = vendorify('transition', this.el[0])
    var rect = this.el[0].getBoundingClientRect()
    this.origin.offset.x = rect.left + (window.scrollX || window.pageXOffset) - this.origin.x
    this.origin.offset.y = rect.top + (window.scrollY || window.pageYOffset) - this.origin.y
    this.origin.scrollX = (window.scrollX || window.pageXOffset)
    this.origin.scrollY = (window.scrollY || window.pageYOffset)
    // the draged element is going to stick right under the cursor
    // setting the css property `pointer-events` to `none` will let
    // the pointer events fire on the elements underneath the helper
    el[0].style.pointerEvents = 'none'
    this.windows.forEach(function(win) {
      $(win).on(MOVE_EVENT, $.proxy(this.move, this))
      $(win).on(END_EVENT, $.proxy(this.stop, this))
    }, this)
    transition(el[0], '')
    trigger(this.eventHandler, 'dragging:start', e)
    return this.el
  }

  Dragging.prototype.stop = function(e) {
    var dropEvent = null
    var revert = true
    if (this.last) {
      var last = this.last
      this.last = null
      dropEvent = trigger($(last), 'dragging:drop', e)
      revert = !dropEvent.isDefaultPrevented()
    }

    if (!this.el) {
      return
    }

    for (var prop in this.originalCss) {
      this.el.css(prop, this.originalCss[prop])
      delete this.originalCss[prop]
    }

    trigger(this.eventHandler, 'dragging:stop', e)
    this.placeholder = null
    if (!this.handle) {
      this.adjustPlacement(e)
    }

    var el = this.el
    if (this.handle) {
      if (revert) {
        el = this.handle
        setTimeout(this.handle.remove.bind(this.handle), 250)
      } else {
        this.handle.remove()
      }
    }

    setTimeout((function(el, origin) {
      transition(el[0], 'all 0.25s ease-in-out 0s')
      vendorify('transform', el[0], origin.transform || '')
      setTimeout(transition.bind(null, el[0], origin.transition || ''), 250)
      el.css('pointer-events', '').css('-ms-touch-action', '').css('touch-action', '')
    }).bind(null, el, this.origin))

    this.windows.forEach(function(win) {
      $(win).off(MOVE_EVENT, this.move)
      $(win).off(END_EVENT, this.stop)
    }, this)
    this.parent = this.el = this.handle = null
  }

  Dragging.prototype.move = function(e) {
    if (!this.el) return

    var doc = this.el[0].ownerDocument
    var win = doc.defaultView || doc.parentWindow

    if (e.type !== 'scroll') {
      var pageX = getTouchPageX(e)
        , pageY = getTouchPageY(e)

      if (e.view !== win && e.view.frameElement) {
        // clientX += e.view.frameElement.offsetLeft
        pageX += e.view.frameElement.offsetLeft

        // clientY += e.view.frameElement.offsetTop
        pageY += e.view.frameElement.offsetTop
      }

      var clientX = e.clientX || window.event && window.event.touches && window.event.touches[0].clientX || 0
        , clientY = e.clientY || window.event && window.event.touches && window.event.touches[0].clientY || 0

      var doc = this.el[0].ownerDocument
      var over = e.view.document.elementFromPoint(clientX, clientY)

      var deltaX = this.lastX - pageX
        , deltaY = this.lastY - pageY
        , direction = Math.abs(deltaX) > Math.abs(deltaY) && deltaX > 0 && 'left'
                   || Math.abs(deltaX) > Math.abs(deltaY) && deltaX < 0 && 'right'
                   || Math.abs(deltaY) > Math.abs(deltaX) && deltaY > 0 && 'up'
                   || 'down'

      if (!dragging.currentTarget) {
        this.setCurrent(over)
      }

      if (this.currentTarget) {
        if (over !== this.last && this.lastEntered !== this.currentTarget) {
          trigger($(this.currentTarget), 'dragging:enter', e)
          trigger($(this.lastEntered), 'dragging:leave', e)
          this.lastEntered = this.currentTarget
        } else if (direction !== this.lastDirection) {
          trigger($(this.currentTarget), 'dragging:diverted', e)
        }
      }

      this.last = over
      this.currentTarget = null
      this.lastDirection = direction
      this.lastX = pageX
      this.lastY = pageY
      this.origin.scrollX = (window.scrollX || window.pageXOffset)
      this.origin.scrollY = (window.scrollY || window.pageYOffset)
    } else {
      var pageX = this.lastX + ((window.scrollX || window.pageXOffset) - this.origin.scrollX)
        , pageY = this.lastY + ((window.scrollY || window.pageYOffset) - this.origin.scrollY)
    }

    var bottom = (pageY - (window.scrollY || window.pageYOffset) - window.innerHeight) * -1
    var bottomReached = document.documentElement.offsetHeight < (window.scrollY || window.pageYOffset) + window.innerHeight
    if (bottom <= 10 && !bottomReached) {
      setTimeout(function() { window.scrollBy(0, 5) }, 50)
    }

    var top = (pageY - (window.scrollY || window.pageYOffset))
    var topReached = (window.scrollY || window.pageYOffset) <= 0
    if (top <= 10 && !topReached) {
      setTimeout(function() { window.scrollBy(0, -5) }, 50)
    }

    var deltaX = pageX - this.origin.x
      , deltaY = pageY - this.origin.y
    var el = this.handle || this.el
    translate(el[0], deltaX, deltaY)
  }

  Dragging.prototype.setCurrent = function(target) {
    this.currentTarget = target
  }

  Dragging.prototype.css = function(prop, val) {
    if (!this.el) return
    this.originalCss[prop] = this.el[0].style[prop] ? this.el.css(prop) : ''
    this.el.css(prop, val)
  }

  Dragging.prototype.adjustPlacement = function(e) {
    translate(this.el[0], 0, 0)
    var rect = this.el[0].getBoundingClientRect()
    this.origin.x = rect.left + (window.scrollX || window.pageXOffset) - this.origin.offset.x
    this.origin.y = rect.top + (window.scrollY || window.pageYOffset) - this.origin.offset.y
    var pageX  = getTouchPageX(e)
      , pageY  = getTouchPageY(e)
      , deltaX = pageX - this.origin.x
      , deltaY = pageY - this.origin.y
    translate(this.el[0], deltaX, deltaY)
  }

  var dragging
  if (parent.$ && parent.$.dragging) {
    dragging = parent.$.dragging
    dragging.windows.push(window)
  }

  dragging = $.dragging = dragging || new Dragging()

  // from https://github.com/rkusa/selector-observer
  var MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver
  function matches(el, selector) {
    var fn = el.matches || el.matchesSelector || el.msMatchesSelector || el.mozMatchesSelector || el.webkitMatchesSelector || el.oMatchesSelector
    return fn ? fn.call(el, selector) : false
  }
  function toArr(nodeList) {
    return Array.prototype.slice.call(nodeList)
  }

  // polyfill for IE < 11
  var isOldIE = false
  if (typeof MutationObserver === 'undefined') {
    MutationObserver = function(callback) {
      this.targets = []
      this.onAdded = function(e) {
        callback([{ addedNodes: [e.target], removedNodes: [] }])
      }
      this.onRemoved = function(e) {
        callback([{ addedNodes: [], removedNodes: [e.target] }])
      }
    }

    MutationObserver.prototype.observe = function(target) {
      target.addEventListener('DOMNodeInserted', this.onAdded)
      target.addEventListener('DOMNodeRemoved', this.onRemoved)
      this.targets.push(target)
    }

    MutationObserver.prototype.disconnect = function() {
      var target
      while (target = this.targets.shift()) {
        target.removeEventListener('DOMNodeInserted', this.onAdded)
        target.removeEventListener('DOMNodeRemoved', this.onRemoved)
      }
    }

    isOldIE = !!~navigator.appName.indexOf('Internet Explorer')
  }

  var SelectorObserver = function(targets, selector, onAdded, onRemoved) {
    var self     = this
    this.targets = targets instanceof NodeList
                     ? Array.prototype.slice.call(targets)
                     : [targets]

    // support selectors starting with the childs only selector `>`
    var childsOnly = selector[0] === '>'
    var search = childsOnly ? selector.substr(1) : selector
    var initialized = false

    function query(nodes, deep) {
      var result = []

      toArr(nodes).forEach(function(node) {
        //ignore non-element nodes
        if (node.nodeType !== 1) return;

        // if looking for childs only, the node's parentNode
        // should be one of our targets
        if (childsOnly && self.targets.indexOf(node.parentNode) === -1) {
          return
        }

        // test if the node itself matches the selector
        if (matches(node, search)) {
          result.push(node)
        }

        if (childsOnly || !deep) {
          return
        }

        toArr(node.querySelectorAll(selector)).forEach(function(node) {
          result.push(node)
        })
      })

      return result
    }

    function apply(nodes, deep, callback) {
      if (!callback) {
        return
      }

      // flatten
      query(nodes, deep)
      // filter unique nodes
      .filter(function(node, i, self) {
        return self.indexOf(node) === i
      })
      // execute callback
      .forEach(function(node) {
        callback.call(node)
      })
    }

    var timeout      = null
    var addedNodes   = []
    var removedNodes = []

    function handle() {
      self.disconnect()

      // filter moved elements (removed and re-added)
      for (var i = 0, len = removedNodes.length; i < len; ++i) {
        var index = addedNodes.indexOf(removedNodes[i])
        if (index > -1) {
          addedNodes.splice(index, 1)
          removedNodes.splice(i--, 1)
        }
      }

      //                ↓ IE workarounds ...
      apply(addedNodes, !(initialized && isOldIE), onAdded)
      apply(removedNodes, true, onRemoved)

      addedNodes.length   = 0
      removedNodes.length = 0

      self.observe()
    }

    this.observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        addedNodes.push.apply(addedNodes, mutation.addedNodes)
        removedNodes.push.apply(removedNodes, mutation.removedNodes)
      })

      // IE < 10 fix: wait a cycle to gather all mutations
      if (timeout) {
        clearTimeout(timeout)
      }
      timeout = setTimeout(handle)
    })

    // call onAdded for existing elements
    if (onAdded) {
      this.targets.forEach(function(target) {
        apply(target.children, true, onAdded)
      })
    }

    initialized = true

    this.observe()
  }

  SelectorObserver.prototype.disconnect = function() {
    this.observer.disconnect()
  }

  SelectorObserver.prototype.observe = function() {
    var self = this
    this.targets.forEach(function(target) {
      self.observer.observe(target, { childList: true, subtree: true })
    })
  }

  var Draggable = function(element, opts) {
    this.id     = nextId++
    this.el     = $(element)
    this.opts   = opts
    this.cancel = opts.handle !== false

    this.connectedWith = []
    if (this.opts.connectWith) {
      this.connectWith(this.opts.connectWith)
    }
  }

  Draggable.prototype.connectWith = function(connectWith) {
    var self = this
    var target = $(connectWith)
    var context = window
    if (target[0].ownerDocument !== document) {
      context = target[0].ownerDocument.defaultView
    }
    context.$(connectWith).each(function() {
      var el = context.$(this)
      if (el[0] === self.el[0]) return
      var instance = el.data('sortable') || el.data('droppable')
      if (instance) instance.connectedWith.push(self.id)
      else {
        el.one('sortable:create droppable:create', function(e, instance) {
          instance.connectedWith.push(self.id)
        })
      }
    })
  }

  Draggable.prototype.create = function() {
    this.el
    .on(START_EVENT, $.proxy(this.start, this))

    var self = this
    setTimeout(function() {
      self.el.trigger('draggable:create', self)
    })
  }

  Draggable.prototype.destroy = function() {
    this.el.off(START_EVENT, this.start)
  }

  Draggable.prototype.enable = function() {
    this.opts.disabled = false
  }

  Draggable.prototype.disable = function() {
    this.opts.disabled = true
  }

  Draggable.prototype.start = function(e) {
    if (this.opts.disabled) {
      return false
    }

    // only start on left mouse button
    if (e.type === 'mousedown' && e.which !== 1) {
      return false
    }

    e = e.originalEvent || e // zepto <> jquery compatibility
    e.preventDefault() // prevent text selection

    if (this.opts.cancel) {
      var target = $(e.target)
      while (target[0] !== this.el[0]) {
        if (target.is(this.opts.cancel)) return false
        target = target.parent()
      }
    }

    if (this.opts.handle) {
      var target = $(e.target), isHandle = false
      while (target[0] !== this.el[0]) {
        if (target.is(this.opts.handle)) {
          isHandle = true
          break
        }
        target = target.parent()
      }
      if (!isHandle) return false
    }

    var el = this.el, handle
    if (this.opts.clone) {
      el = this.el.clone()
      handle = this.el.clone()
      var position = this.el.position()
      handle.css('position', 'absolute')
            .css('left', position.left).css('top', position.top)
            .width(this.el.width()).height(this.el.height())
      handle.insertAfter(this.el)
    }

    dragging.start(this, el, e, handle)
  }

  var Droppable = function(element, opts) {
    this.id            = nextId++
    this.el            = $(element)
    this.opts          = opts
    this.accept        = false
    this.connectedWith = []
  }

  Droppable.prototype.create = function() {
    this.el
    .on('dragging:enter', $.proxy(this.enter, this))
    .on('dragging:leave', $.proxy(this.leave, this))
    .on('dragging:drop',  $.proxy(this.drop, this))

    dragging
    .on('dragging:start', $.proxy(this.activate, this))
    .on('dragging:stop',  $.proxy(this.reset, this))

    var self = this
    setTimeout(function() {
      self.el.trigger('droppable:create', self)
    })
  }

  Droppable.prototype.destroy = function() {
    this.el
    .off('dragging:enter', this.enter)
    .off('dragging:leave', this.leave)
    .off('dragging:drop',  this.drop)

    // Todo: Fix Zepto Bug
    // dragging
    // .off('dragging:start', this.activate)
    // .off('dragging:stop',  this.reset)
  }

  Droppable.prototype.enable = function() {
    this.opts.disabled = false
  }

  Droppable.prototype.disable = function() {
    this.opts.disabled = true
  }

  Droppable.prototype.activate = function(e) {
    this.accept = this.connectedWith.indexOf(dragging.parent.id) !== -1
    if (!this.accept) {
      var accept = this.opts.accept === '*'
                || (typeof this.opts.accept === 'function' ? this.opts.accept.call(this.el[0], dragging.el)
                                                           : dragging.el.is(this.opts.accept))
      if (this.opts.scope !== 'default') {
        this.accept = dragging.parent.opts.scope === this.opts.scope
        if (!this.accept && this.opts.accept !== '*') this.accept = accept
      } else this.accept = accept
    }

    if (!this.accept) return
    if (this.opts.activeClass)
      this.el.addClass(this.opts.activeClass)

    trigger(this.el, 'droppable:activate', e, { item: dragging.el })
  }

  Droppable.prototype.reset = function(e) {
    if (!this.accept) return
    if (this.opts.activeClass) this.el.removeClass(this.opts.activeClass)
    if (this.opts.hoverClass)  this.el.removeClass(this.opts.hoverClass)

    trigger(this.el, 'droppable:deactivate', e, { item: dragging.el })
  }

  Droppable.prototype.enter = function(e) {
    if (this.opts.disabled) return false

    e.stopPropagation()

    // hide placeholder, if set (e.g. enter the droppable after
    // entering a sortable)
    if (dragging.placeholder) dragging.placeholder.hide()

    if (!this.accept) return

    if (this.opts.hoverClass) {
      this.el.addClass(this.opts.hoverClass)
    }

    trigger(this.el, 'droppable:over', e, { item: dragging.el })
  }

  Droppable.prototype.leave = function(e) {
    if (this.opts.disabled) return false
    // e.stopPropagation()

    if (this.opts.hoverClass && this.accept) {
      this.el.removeClass(this.opts.hoverClass)
    }

    trigger(this.el, 'droppable:out', e, { item: dragging.el })
  }

  Droppable.prototype.drop = function(e) {
    if (this.opts.disabled || !this.accept) return false

    if (!dragging.el) return

    e.preventDefault() // accept drop

    // zepto <> jquery compatibility
    var el = dragging.el
    $(this.el).append(el)

    trigger(this.el, 'droppable:drop', e, { item: el })
  }

  var Sortable = function(element, opts) {
    this.id   = nextId++
    this.el   = element
    this.opts = opts

    var tag = this.opts.placeholderTag
    if (!tag) {
      try {
        tag = this.el.find(this.opts.items)[0].tagName
      } catch(e) {
        tag = /^ul|ol$/i.test(this.el[0].tagName) ? 'li' : 'div'
      }
    }

    this.placeholder = $('<' + tag + ' class="' + this.opts.placeholder + '" />')

    this.accept = this.index = this.direction = null
    this.connectedWith = []
    if (this.opts.connectWith) {
      this.connectWith(this.opts.connectWith)
    }
  }

  Sortable.prototype.connectWith = Draggable.prototype.connectWith

  Sortable.prototype.create = function() {
    this.el
    .on(START_EVENT,         this.opts.items, $.proxy(this.start, this))
    .on('dragging:enter',    this.opts.items, $.proxy(this.enter, this))
    .on('dragging:diverted', this.opts.items, $.proxy(this.diverted, this))
    .on('dragging:drop',     this.opts.items, $.proxy(this.drop, this))

    this.el
    .on('dragging:enter',    $.proxy(this.enter, this))
    .on('dragging:diverted', $.proxy(this.diverted, this))
    .on('dragging:drop',     $.proxy(this.drop, this))

    dragging
    .on('dragging:start', $.proxy(this.activate, this))
    .on('dragging:stop',  $.proxy(this.reset, this))

    var self = this
    setTimeout(function() {
      self.el.trigger('sortable:create', self)
    })

    this.observer = new SelectorObserver(this.el[0], this.opts.items, function() {
    }, function() {
      if (this === self.placeholder[0] || (dragging.el && this === dragging.el[0])) {
        return
      }
      var item = $(this)
      self.el.trigger('sortable:change', { item: item })
      self.el.trigger('sortable:update', { item: item, index: -1 })
    })
  }

  Sortable.prototype.destroy = function() {
    this.el
    .off(START_EVENT,         this.opts.items, this.start)
    .off('dragging:enter',    this.opts.items, this.enter)
    .off('dragging:diverted', this.opts.items, this.diverted)
    .off('dragging:drop',     this.opts.items, this.drop)

    this.el
    .off('dragging:enter',    this.enter)
    .off('dragging:diverted', this.diverted)
    .off('dragging:drop',     this.drop)

    // Todo: Fix Zepto Bug
    // dragging
    // .off('dragging:start', this.activate)
    // .off('dragging:stop',  this.reset)

    this.observer.disconnect()
  }

  Sortable.prototype.enable = function() {
    this.opts.disabled = false
  }

  Sortable.prototype.disable = function() {
    this.opts.disabled = true
  }

  Sortable.prototype.activate = function(e) {
    this.accept  = dragging.parent.id === this.id
                   || !!~this.connectedWith.indexOf(dragging.parent.id)
    this.isEmpty = this.el.find(this.opts.items).length === 0

    if (!this.accept) return

    this.accept = dragging.parent.id === this.id
      || this.opts.accept === '*'
      || (typeof this.opts.accept === 'function'
        ? this.opts.accept.call(this.el[0], dragging.el)
        : dragging.el.is(this.opts.accept))

    if (!this.accept) return

    if (this.opts.activeClass)
      this.el.addClass(this.opts.activeClass)

    trigger(this.el, 'sortable:activate', e, { item: dragging.el })
  }

  Sortable.prototype.reset = function(e) {
    if (!this.accept) return
    if (this.opts.activeClass) {
      this.el.removeClass(this.opts.activeClass)
    }

    trigger(this.el, 'sortable:deactivate', e, { item: dragging.el })

    if (this.index !== null) {
      trigger(this.el, 'sortable:beforeStop', e, { item: dragging.el })
      trigger(this.el, 'sortable:stop', e, { item: dragging.el })
      this.index = null
    }
  }

  Sortable.prototype.indexOf = function(el) {
    return this.el.find(this.opts.items).index(el)
  }

  Sortable.prototype.start = function(e) {
    if (this.opts.disabled || dragging.el) {
      return
    }

    // only start on left mouse button
    if (e.type === 'mousedown' && e.which !== 1) {
      return false
    }

    if (this.opts.cancel) {
      var target = $(e.target)
      while (target[0] !== this.el[0]) {
        if (target.is(this.opts.cancel)) return
        target = target.parent()
      }
    }

    if (this.opts.handle) {
      var target = $(e.target), isHandle = false
      while (target[0] !== this.el[0]) {
        if (target.is(this.opts.handle)) {
          isHandle = true
          break
        }
        target = target.parent()
      }
      if (!isHandle) return
    }

    e.stopPropagation()
    e.preventDefault() // prevent text selection

    // use e.currentTarget instead of e.target because we want the target
    // the event is bound to, not the target (child) the event is triggered from
    dragging.start(this, $(e.currentTarget), e)

    this.index = this.indexOf(dragging.el)

    dragging.el.before(dragging.placeholder = this.placeholder.show())

    // if dragging an item that belongs to the current list, hide it while
    // it is being dragged
    if (this.index !== null) {
      // zepto <> jquery compatibility
      var height = dragging.el.outerHeight ? dragging.el.outerHeight() : dragging.el.height()
      var marginBottom = parseInt(dragging.el.css('margin-bottom'), 10)
      dragging.css('margin-bottom', (height + Math.max(0, marginBottom)) * -1)
    }

    if (this.opts.forcePlaceholderSize) {
      this.placeholder.height(parseFloat(dragging.el.css('height')))
      this.placeholder.width(parseFloat(dragging.el.css('width')))
    }

    dragging.adjustPlacement(e)

    trigger(this.el, 'sortable:start', e, { item: dragging.el })
  }

  Sortable.prototype.enter = function(e) {
    if (!this.accept || this.opts.disabled) return

    e.stopPropagation()

    // stop if event is fired on the placeholder
    var child = e.currentTarget, isContainer = child === this.el[0]
    if (child === this.placeholder[0]) return
    child = $(child)

    // the container fallback is only necessary for empty sortables
    if (isContainer && !this.isEmpty && this.placeholder.parent().length)
      return

    dragging.placeholder = this.placeholder

    if (this.opts.forcePlaceholderSize) {
      this.placeholder.height(parseFloat(dragging.el.css('height')))
      this.placeholder.width(parseFloat(dragging.el.css('width')))
    }

    if (!isContainer) {
      // insert the placeholder according to the dragging direction
      this.direction = this.indexOf(this.placeholder.show()) < this.indexOf(child) ? 'down' : 'up'
      child[this.direction === 'down' ? 'after' : 'before'](this.placeholder)
      dragging.adjustPlacement(e)
    } else {
      this.el.append(this.placeholder)
    }

    this.el.trigger('sortable:change', { item: dragging.el })
  }

  Sortable.prototype.diverted = function(e) {
    if (!this.accept || this.opts.disabled) return
    e.stopPropagation()

    var child = $(e.currentTarget), isContainer = child[0] === this.el[0]
    if (isContainer) return

    // insert the placeholder according to the dragging direction
    dragging.placeholder = this.placeholder
    this.direction = this.indexOf(this.placeholder.show()) < this.indexOf(child) ? 'down' : 'up'
    child[this.direction === 'down' ? 'after' : 'before'](this.placeholder)
    dragging.adjustPlacement(e)
  }

  Sortable.prototype.drop = function(e) {
    if (!this.accept || this.opts.disabled) return

    e.stopPropagation()
    e.preventDefault()

    if (!dragging.el) return
    if (!this.placeholder.parent().length) return

    trigger(this.el, 'sortable:beforeStop', e, { item: dragging.el })

    this.observer.disconnect()

    var newIndex = this.indexOf(this.placeholder)
    if (newIndex > this.index) {
      newIndex--
    }

    if (typeof this.opts.updatePosition === 'function') {
      this.opts.updatePosition.call(this, { item: dragging.el, index: newIndex })
    } else {
      dragging.el.insertBefore(this.placeholder)
    }

    // if the dropped element belongs to another list, trigger the receive event
    if (this.index === null) { // dropped element belongs to another list
      trigger(this.el, 'sortable:receive', e, { item: dragging.el })
      this.el.trigger('sortable:update', { item: dragging.el, index: newIndex })
    }
    // if the index changed, trigger the update event
    else if (newIndex !== this.index) {
      this.el.trigger('sortable:update', { item: dragging.el, index: newIndex })
    }

    trigger(this.el, 'sortable:stop', e, { item: dragging.el })
    this.index = null
    this.observer.observe()
  }

  Sortable.prototype.toArray = function(opts) {
    if (!opts) opts = {}
    var attr = opts.attribute || 'id', attrs = []
    this.el.find(this.opts.items).each(function() {
      attrs.push($(this).prop(attr))
    })
    return attrs
  }

  function generic(constructor, identifier, defaults) {
    return function(opts, name, value) {
      var result = []
      this.each(function() {
        var instance = $(this).data(identifier)
        if (typeof opts === 'string') {
          if (typeof instance === 'undefined')
            throw new Error(identifier + ' not defined')
          switch (opts) {
          case 'enable':  instance.enable();  break
          case 'disable': instance.disable(); break
          case 'destroy':
            instance.destroy()
            $(this).removeData(identifier)
            break
          case 'option':
            // set
            if (value !== undefined)
              instance.opts[name] = value
            else if (typeof name === 'object')
              instance.opts = $.extend(instance.opts, name)
            // get
            else if (name)
              result.push(instance.opts[name])
            else
              result.push(instance.opts)
            break
          // case 'serialize':
          //   if (identifier !== 'sortable') return
          //   result.push(instance.serialize())
          //   break
          case 'toArray':
            if (identifier !== 'sortable') return
            result.push(instance.toArray(name))
            break
          }
        } else {
          if (instance) {
            $.extend(instance.opts, opts) // merge options
            return this
          }
          instance = new constructor($(this), $.extend({}, defaults, opts))
          instance.create()
          $(this).data(identifier, instance)
        }
      })

      if (result.length)
        return result.length === 1 ? result[0] : result
      else
        return this
    }
  }

  $.fn.draggable = generic(Draggable, 'draggable', {
    cancel: 'input, textarea, button, select, option',
    connectWith: false,
    cursor: 'auto',
    disabled: false,
    handle: false,
    initialized: false,
    clone: false,
    scope: 'default'
  })

  $.fn.droppable = generic(Droppable, 'droppable', {
    accept: '*',
    activeClass: false,
    disabled: false,
    hoverClass: false,
    initialized: false,
    scope: 'default'
  })

  $.fn.sortable = generic(Sortable, 'sortable', {
    accept: '*',
    activeClass: false,
    cancel: 'input, textarea, button, select, option',
    connectWith: false,
    disabled: false,
    forcePlaceholderSize: false,
    handle: false,
    initialized: false,
    items: 'li, div',
    placeholder: 'placeholder',
    placeholderTag: null,
    updatePosition: null
  })
})(window.Zepto || window.jQuery);
