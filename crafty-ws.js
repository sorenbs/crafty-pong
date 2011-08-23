/*!
* Crafty v0.4.3
* http://craftyjs.com
*
* Copyright 2010, Louis Stowasser
* Dual licensed under the MIT or GPL licenses.
*/(function(window, undefined) {

/**@
* #Crafty
* @category Core
* Select a set of or single entities by components or an entity's ID.
*
* Crafty uses syntax similar to jQuery by having a selector engine to select entities by their components.
*
* @example
* ~~~
*    Crafty("mycomponent")
*    Crafty("hello 2D component")
*    Crafty("hello, 2D, component")
* ~~~
* The first selector will return all entities that has the component `mycomponent`. The second will return all entities that has `hello` and `2D` and `component` whereas the last will return all entities that has at least one of those components (or).
* ~~~
*   Crafty(1)
* ~~~
* Passing an integer will select the entity with that `ID`.
*
* Finding out the `ID` of an entity can be done by returning the property `0`.
* ~~~
*    var ent = Crafty.e("2D");
*    ent[0]; //ID
* ~~~
*/
var Crafty = function(selector) {
		return new Crafty.fn.init(selector);
	},
	
	GUID = 1, //GUID for entity IDs
	FPS = 50,
	frame = 1,
	
	components = {}, //map of components and their functions
	entities = {}, //map of entities and their data
	handlers = {}, //global event handlers
	onloads = [], //temporary storage of onload handlers
	tick,
	tickID,

	noSetter,
	
	loops = 0, 
	skipTicks = 1000 / FPS,
	nextGameTick = (new Date).getTime(),
	
	slice = Array.prototype.slice,
	rlist = /\s*,\s*/,
	rspace = /\s+/;

/**@
* #Crafty Core
* @category Core
* Set of methods added to every single entity.
*/
Crafty.fn = Crafty.prototype = {

	init: function(selector) {
		//select entities by component
		if(typeof selector === "string") {
			var elem = 0, //index elements
				e, //entity forEach
				current,
				and = false, //flags for multiple
				or = false,
				del,
                comps,
                score,
                i, l;
			
			if(selector === '*') {
				for(e in entities) {
					this[+e] = entities[e];
					elem++;
				}
				this.length = elem;
				return this;
			}
			
			//multiple components OR
			if(selector.indexOf(',') !== -1) {
				or = true;
				del = rlist;
			//deal with multiple components AND
			} else if(selector.indexOf(' ') !== -1) {
				and = true;
				del = rspace;
			}
			
			//loop over entities
			for(e in entities) {
				if(!entities.hasOwnProperty(e)) continue; //skip
				current = entities[e];
				
				if(and || or) { //multiple components
					comps = selector.split(del); 
                    i = 0;
                    l = comps.length;
                    score = 0;
					
					for(;i<l;i++) //loop over components
						if(current.__c[comps[i]]) score++; //if component exists add to score 
					
					//if anded comps and has all OR ored comps and at least 1
					if(and && score === l || or && score > 0) this[elem++] = +e;
					
				} else if(current.__c[selector]) this[elem++] = +e; //convert to int
			}
			
			//extend all common components
			if(elem > 0 && !and && !or) this.extend(components[selector]);
			if(comps && and) for(i=0;i<l;i++) this.extend(components[comps[i]]);
			
			this.length = elem; //length is the last index (already incremented)
			
		} else { //Select a specific entity
			
			if(!selector) { //nothin passed creates God entity
				selector = 0;
				if(!(selector in entities)) entities[selector] = this;
			}
			
			//if not exists, return undefined
			if(!(selector in entities)) {
				this.length = 0;
				return this;
			}
			
			this[0] = selector;
			this.length = 1;
			
			//update from the cache
			if(!this.__c) this.__c = {};
			
			//update to the cache if NULL
			if(!entities[selector]) entities[selector] = this; 
			return entities[selector]; //return the cached selector
		}
		
		return this;
	},
	
	/**@
	* #.addComponent
	* @comp Crafty Core
	* @sign public this .addComponent(String componentList)
	* @param componentList - A string of components to add seperated by a comma `,`
	* @sign public this .addComponent(String component1[, .., String componentN])
	* @param component# - Component ID to add.
	* Adds a component to the selected entities or entity. 
	*
	* Components are used to extend the functionality of entities. 
	* This means it will copy properties and assign methods to 
	* augment the functionality of the entity.
	* 
	* There are multiple methods of adding components. Passing a 
	* string with a list of component names or passing multiple 
	* arguments with the component names.
	*
	* @example
	* ~~~
	* this.addComponent("2D, canvas, health");
	* this.addComponent("2D", "canvas", "health");
	* ~~~
	*/
	addComponent: function(id) {
		var uninit = [], c = 0, ul, //array of components to init
            i = 0, l, comps;
		
		//add multiple arguments
		if(arguments.length > 1) {
            l = arguments.length;
			for(;i<l;i++) {
				this.__c[arguments[i]] = true;
				uninit.push(arguments[i]);
			}
		//split components if contains comma
		} else if(id.indexOf(',') !== -1) {
			comps = id.split(rlist);
            l = comps.length;
			for(;i<l;i++) {
				this.__c[comps[i]] = true;
				uninit.push(comps[i]);
			}
		//single component passed
		} else {
			this.__c[id] = true;
			uninit.push(id);
		}
		
		//extend the components
		ul = uninit.length;
		for(;c<ul;c++) {
			comp = components[uninit[c]];
			this.extend(comp);
			
			//if constructor, call it
			if(comp && "init" in comp) {
				comp.init.call(this);
			}
		}
		
		this.trigger("NewComponent", ul);
		return this;
	},
	
	/**@
	* #.requires
	* @comp Crafty Core
	* @sign public this .requires(String componentList)
	* @param componentList - List of components that must be added
	* Makes sure the entity has the components listed. If the entity does not
	* have the component, it will add it.
	* @see .addComponent
	*/
	requires: function(list) {
		var comps = list.split(rlist),
			i = 0, l = comps.length,
			comp;
		
		//loop over the list of components and add if needed
		for(;i<l;++i) {
			comp = comps[i];
			if(!this.has(comp)) this.addComponent(comp);
		}

        return this;
	},
	
	/**@
	* #.removeComponent
	* @comp Crafty Core
	* @sign public this .removeComponent(String component[, soft])
	* @param component - Component to remove
	* @param soft - Whether to soft remove it (defaults to `true`)
	* Removes a component from an entity. A soft remove will only 
	* refrain `.has()` from returning true. Hard will remove all
	* associated properties and methods.
	*/
	removeComponent: function(id, soft) {
		if(soft === false) {
			var props = components[id], prop;
			for(prop in props) {
				delete this[prop];
			}
		}
		delete this.__c[id];
		
		this.trigger("RemoveComponent", id);
		return this;
	},
	
	/**@
	* #.has
	* @comp Crafty Core
	* @sign public Boolean .has(String component)
	* Returns `true` or `false` depending on if the 
	* entity has the given component.
	*
	* For better performance, simply use the `.__c` object 
	* which will be `true` if the entity has the component or 
	* will not exist (or be `false`).
	*/
	has: function(id) {
		return !!this.__c[id];
	},
	
	/**@
	* #.attr
	* @comp Crafty Core
	* @sign public this .attr(String property, * value)
	* @param property - Property of the entity to modify
	* @param value - Value to set the property to
	* @sign public this .attr(Object map)
	* @param map - Object where the key is the property to modify and the value as the property value
	* Use this method to set any property of the entity.
	* @example
	* ~~~
	* this.attr({key: "value", prop: 5});
	* this.key; //value
	* this.prop; //5
	*
	* this.attr("key", "newvalue");
	* this.key; //newvalue
	* ~~~
	*/
	attr: function(key, value) {
		if(arguments.length === 1) {
			//if just the key, return the value
			if(typeof key === "string") {
				return this[key];
			}
			
			//extend if object
			this.extend(key);
			this.trigger("Change", key); //trigger change event
			return this;
		}
		//if key value pair
		this[key] = value;

		var change = {};
		change[key] = value;
		this.trigger("Change", change ); //trigger change event
		return this;
	},
	
	/**@
	* #.toArray
	* @comp Crafty Core
	* @sign public this .toArray(void)
	* This method will simply return the found entities as an array.
	*/
	toArray: function() {
		return slice.call(this, 0);
	},
	
	/**@
	* #.delay
	* @comp Crafty Core
	* @sign public this .delay(Function callback, Number delay)
	* @param callback - Method to execute after given amount of milliseconds
	* @param delay - Amount of milliseconds to execute the method
	* The delay method will execute a function after a given amount of time in milliseconds.
	*
	* Essentially a wrapper for `setTimeout`.
	*
	* @example
    * Destroy itself after 100 milliseconds
	* ~~~
	* this.delay(function() {
	     this.destroy();
	* }, 100);
	* ~~~
	*/
	delay: function(fn, duration) {
		this.each(function() {
			var self = this;
			setTimeout(function() {
				fn.call(self);
			}, duration);
		});
        return this;
	},
	
	/**@
	* #.bind
	* @comp Crafty Core
	* @sign public this .bind(String eventName, Function callback)
	* @param eventName - Name of the event to bind to
	* @param callback - Method to execute when the event is triggered
	* Attach the current entity (or entities) to listen for an event.
	*
	* Callback will be invoked when an event with the event name passed 
	* is triggered. Depending on the event, some data may be passed 
	* via an argument to the callback function.
	*
	* The first argument is the event name (can be anything) whilst the 
	* second argument is the callback. If the event has data, the 
	* callback should have an argument.
	*
	* Events are arbitrary and provide communication between components. 
	* You can trigger or bind an event even if it doesn't exist yet.
	* @example
	* ~~~
	* this.attr("triggers", 0); //set a trigger count
	* this.bind("myevent", function() {
	*     this.triggers++; //whenever myevent is triggered, increment
	* });
	* this.bind("EnterFrame", function() {
	*     this.trigger("myevent"); //trigger myeven on every frame
	* });
	* ~~~
	* @see .trigger, .unbind
	*/
	bind: function(event, fn) {
		//optimization for 1 entity
		if(this.length === 1) {
			if(!handlers[event]) handlers[event] = {};
			var h = handlers[event];
			
			if(!h[this[0]]) h[this[0]] = []; //init handler array for entity
			h[this[0]].push(fn); //add current fn
			return this;
		}
		
		this.each(function() {
			//init event collection
			if(!handlers[event]) handlers[event] = {};
			var h = handlers[event];
			
			if(!h[this[0]]) h[this[0]] = []; //init handler array for entity
			h[this[0]].push(fn); //add current fn
		});
		return this;
	},
	
	/**@
	* #.unbind
	* @comp Crafty Core
	* @sign public this .unbind(String eventName[, Function callback])
	* @param eventName - Name of the event to unbind
	* @param callback - Function to unbind
	* Removes binding with an event from current entity. 
	*
	* Passing an event name will remove all events binded to 
	* that event. Passing a reference to the callback will 
	* unbind only that callback.
	* @see .bind, .trigger
	*/
	unbind: function(event, fn) {
		this.each(function() {
			var hdl = handlers[event], i = 0, l, current;
			//if no events, cancel
			if(hdl && hdl[this[0]]) l = hdl[this[0]].length;
			else return this;
			
			//if no function, delete all
			if(!fn) {
				delete hdl[this[0]];
				return this;
			}
			//look for a match if the function is passed
			for(;i<l;i++) {
				current = hdl[this[0]];
				if(current[i] == fn) {
					current.splice(i,1);
					i--;
				}
			}
		});
		
		return this;
	},
	
	/**@
	* #.trigger
	* @comp Crafty Core
	* @sign public this .trigger(String eventName[, Object data])
	* @param eventName - Event to trigger
	* @param data - Arbitrary data that will be passed into every callback as an argument
	* Trigger an event with arbitrary data. Will invoke all callbacks with 
	* the context (value of `this`) of the current entity object.
	*
	* *Note: This will only execute callbacks within the current entity, no other entity.*
	*
	* The first argument is the event name to trigger and the optional 
	* second argument is the arbitrary event data. This can be absolutely anything.
	*/
	trigger: function(event, data) {
		if(this.length === 1) {
			//find the handlers assigned to the event and entity
			if(handlers[event] && handlers[event][this[0]]) {
				var fns = handlers[event][this[0]], i = 0, l = fns.length;
				for(;i<l;i++) {
					fns[i].call(this, data);
				}
			}
			return this;
		}
		
		this.each(function() {
			//find the handlers assigned to the event and entity
			if(handlers[event] && handlers[event][this[0]]) {
				var fns = handlers[event][this[0]], i = 0, l = fns.length;
				for(;i<l;i++) {
					fns[i].call(this, data);
				}
			}
		});
		return this;
	},
	
	/**@
	* #.each
	* @sign public this .each(Function method)
	* @param method - Method to call on each iteration
	* Iterates over found entities, calling a function for every entity. 
	*
	* The function will be called for every entity and will pass the index 
	* in the iteration as an argument. The context (value of `this`) of the 
	* function will be the current entity in the iteration.
	* @example
	* Destroy every second 2D entity
	* ~~~
	* Crafty("2D").each(function(i) {
	*     if(i % 2 === 0) {
	*         this.destroy();
	*     }
	* });
	* ~~~
	*/
	each: function(fn) {
		var i = 0, l = this.length;
		for(;i<l;i++) {
			//skip if not exists
			if(!entities[this[i]]) continue;
			fn.call(entities[this[i]],i);
		}
		return this;
	},
	
	/**@
	* #.clone
	* @comp Crafty Core
	* @sign public Entity .clone(void)
	* @returns Cloned entity of the current entity
	* Method will create another entity with the exact same
	* properties, components and methods as the current entity.
	*/
	clone: function() {
		var comps = this.__c,
			comp,
			prop,
			clone = Crafty.e();
			
		for(comp in comps) {
			clone.addComponent(comp);
		}
		for(prop in this) {
			clone[prop] = this[prop];
		}
		
		return clone;
	},
	
	/**@
	* #.setter
	* @comp Crafty Core
	* @sign public this .setter(String property, Function callback)
	* @param property - Property to watch for modification
	* @param callback - Method to execute if the property is modified
	* Will watch a property waiting for modification and will then invoke the
	* given callback when attempting to modify.
	*
	* *Note: Support in IE<9 is slightly different. The method will be execute
	* after the property has been set*
	*/
	setter: function(prop, fn) {
		if(Crafty.support.setter) {
			this.__defineSetter__(prop, fn);
		} else if(Crafty.support.defineProperty) {
			Object.defineProperty(this, prop, {
                set: fn,
                configurable : true
			});
		} else {
			noSetter.push({
				prop: prop,
				obj: this,
				fn: fn
			});
		}
        return this;
	},
	
	/**@
	* #.destroy
	* @comp Crafty Core
	* @sign public this .destroy(void)
	* @triggers Remove
	* Will remove all event listeners and delete all properties as well as removing from the stage
	*/
	destroy: function() {
		//remove all event handlers, delete from entities
		this.each(function() {
			this.trigger("Remove");
			for(var e in handlers) {
				this.unbind(e);
			}
			delete entities[this[0]];
		});
	}
};

//give the init instances the Crafty prototype
Crafty.fn.init.prototype = Crafty.fn;

/**
* Extension method to extend the namespace and
* selector instances
*/
Crafty.extend = Crafty.fn.extend = function(obj) {
	var target = this, key;
	
	//don't bother with nulls
	if(!obj) return target;
	
	for(key in obj) {
		if(target === obj[key]) continue; //handle circular reference
		target[key] = obj[key];
	}
	
	return target;
};

/**@
* #Crafty.extend
* @category Core
* Used to extend the Crafty namespace.
*/
Crafty.extend({
	/**@
	* #Crafty.init
	* @category Core
	* @sign public this Crafty.init([Number width, Number height])
	* @param width - Width of the stage
	* @param height - Height of the stage
	* Starts the `EnterFrame` interval. This will call the `EnterFrame` event for every frame.
	*
	* Can pass width and height values for the stage otherwise will default to window size (see `Crafty.DOM.window`).
	*
	* All `Load` events will be executed.
	*
	* Uses `requestAnimationFrame` to sync the drawing with the browser but will default to `setInterval` if the browser does not support it.
	* @see Crafty.stop
	*/
	init: function(w, h) {
		Crafty.viewport.init(w,h);
		
		//call all arbitrary functions attached to onload
		this.trigger("Load");
		this.timer.init();
		
		return this;
	},
	
	/**@
	* #Crafty.stop
	* @category Core
	* @sign public this Crafty.stop(void)
	* Stops the Enterframe interval and removes the stage element. 
	*
	* To restart, use `Crafty.init()`.
	* @see Crafty.init
	*/
	stop: function() {
		this.timer.stop();
		Crafty.stage.elem.parentNode.removeChild(Crafty.stage.elem);
		
		return this;
	},
	
	/**@
	* #Crafty.pause
	* @comp Core
	* @sign public this Crafty.pause(void)
	* Pauses the game by stoping the EnterFrame event from firing. Pauses automatically
	* when the user navigates away from the window. This can be turned off in `Crafty.settings`.
	* @example
	* Have an entity pause the game when it is clicked.
	* ~~~
	* button.bind("click", function() {
	* 	Crafty.pause(); 
	* });
	* ~~~
	*/
	pause: function() {
		if(!this._paused) {
			this.trigger('Pause');
			this._paused = true;
			
			Crafty.timer.stop();
			Crafty.keydown = {};
		} else {
			this.trigger('Unpause');
			this._paused = false;
			
			Crafty.timer.init();
		}
		return this;
	},
	
	timer: {
		prev: (+new Date),
		current: (+new Date),
		fps: 0,
		
		init: function() {
			var onFrame = window.requestAnimationFrame ||
					window.webkitRequestAnimationFrame ||
					window.mozRequestAnimationFrame ||
					window.oRequestAnimationFrame ||
					window.msRequestAnimationFrame ||
					null;
			
			if(onFrame) {
				tick = function() { 
					Crafty.timer.step();
					tickID = onFrame(tick); 
				}
				
				tick();
			} else {
				tick = setInterval(Crafty.timer.step, 1000 / FPS);
			}
		},
		
		stop: function() {
			Crafty.trigger("CraftyStop");
			
			if(typeof tick === "number") clearInterval(tick);
		
			var onFrame = window.cancelRequestAnimationFrame ||
					window.webkitCancelRequestAnimationFrame ||
					window.mozCancelRequestAnimationFrame ||
					window.oCancelRequestAnimationFrame ||
					window.msCancelRequestAnimationFrame ||
					null;
						
			if(onFrame) onFrame(tickID);
			tick = null;
		},
		
		step: function() {
			loops = 0;
			while((new Date).getTime() > nextGameTick) {
				Crafty.trigger("EnterFrame", {frame: frame++});
				nextGameTick += skipTicks;
				loops++;
			}
			if(loops) {
				Crafty.DrawManager.draw();
			}
		},

		getFPS: function() {
			return this.fps;
		}
	},

	/**@
	* #Crafty.e
	* @category Core
	* @sign public Entity Crafty.e(String componentList)
	* @param componentList - List of components to assign to new entity
	* @sign public Entity Crafty.e(String component1[, .., String componentN])
	* @param component# - Component to add
	* Creates an entity. Any arguments will be applied in the same 
	* way `.addComponent()` is applied as a quick way to add components.
	*
	* From here, any component added will augment the functionality of 
	* that entity by assigning the properties and methods to that entity. 
	*/
	e: function() {
		var id = UID(), craft;
		
		entities[id] = null; //register the space
		entities[id] = craft = Crafty(id);
		
		if(arguments.length > 0) {
			craft.addComponent.apply(craft, arguments);
		}
		craft.addComponent("obj"); //every entity automatically assumes obj
		
		return craft;
	},
	
	/**@
	* #Crafty.c
	* @category Core
	* @sign public void Crafty.c(String name, Object component)
	* @param name - Name of the component
	* @param component - Object with the components properties and methods
	* Creates a component where the first argument is the ID and the second 
	* is the object that will be inherited by entities.
	*
	* There is a convention for writing components. For instance properties or 
	* methods that start with an underscore are considered private. A method called 
	* `init` will automatically be called as soon as the component is added to 
	* an entity. 
	* 
	* A method with the same name as the component ID is considered to be a constructor 
	* and is generally used when data is needed before executing.
	*/
	c: function(id, fn) {
		components[id] = fn;
	},
	
	/**@
	* #Crafty.trigger
	* @category Core, Events
	* @sign public void Crafty.trigger(String eventName, * data)
	* @param eventName - Name of the event to trigger
	* @param data - Arbitrary data to pass into the callback as an argument
	* This method will trigger every single callback attached to the event name. This means
	* every global event and every entity that has a callback.
	* @see Crafty.bind
	*/
	trigger: function(event, data) {
		var hdl = handlers[event], h, i, l;
		//loop over every object bound
		for(h in hdl) {
			if(!hdl.hasOwnProperty(h)) continue;
			
			//loop over every handler within object
			for(i = 0, l = hdl[h].length; i < l; i++) {
				if(hdl[h] && hdl[h][i]) {
					//if an entity, call with that context
					if(entities[h]) {
						hdl[h][i].call(Crafty(+h), data);
					} else { //else call with Crafty context
						hdl[h][i].call(Crafty, data);
					}
				}
			}
		}
	},
	
	/**@
	* #Crafty.bind
	* @category Core, Events
	* @sign public Number bind(String eventName, Function callback)
	* @param eventName - Name of the event to bind to
	* @param callback - Method to execute upon event triggered
	* @returns ID of the current callback used to unbind
	* Binds to a global event. Method will be executed when `Crafty.trigger` is used
	* with the event name.
	* @see Crafty.trigger, Crafty.unbind
	*/
	bind: function(event, callback) {
		if(!handlers[event]) handlers[event] = {};
		var hdl = handlers[event];
		
		if(!hdl.global) hdl.global = [];
		return hdl.global.push(callback) - 1;
	},
	
	/**@
	* #Crafty.unbind
	* @category Core, Events
	* @sign public Boolean Crafty.unbind(String eventName, Function callback)
	* @param eventName - Name of the event to unbind
	* @param callback - Function to unbind
	* @sign public Boolean Crafty.unbind(String eventName, Number callbackID)
	* @param callbackID - ID of the callback
	* @returns True or false depending on if a callback was unbound
	* Unbind any event from any entity or global event.
	*/
	unbind: function(event, callback) {
		var hdl = handlers[event], h, i, l;
		
		//loop over every object bound
		for(h in hdl) {
			if(!hdl.hasOwnProperty(h)) continue;
			
			//if passed the ID
			if(typeof callback === "number") {
				delete hdl[h][callback];
				return true;
			}
			
			//loop over every handler within object
			for(i = 0, l = hdl[h].length; i < l; i++) {
				if(hdl[h][i] === callback) {
					delete hdl[h][i];
					return true;
				}
			}
		}
		
		return false;
	},
	
	/**@
	* #Crafty.frame
	* @category Core
	* @sign public Number Crafty.frame(void)
	* Returns the current frame number
	*/
	frame: function() {
		return frame;
	},
	
	components: function() {
		return components;
	},
	
	isComp: function(comp) {
		return comp in components;
	},
	
	debug: function() {
		return entities;
	},
	
	/**@
	* #Crafty.settings
	* @category Core
	* Modify the inner workings of Crafty through the settings.
	*/
	settings: (function() {
		var states = {},
			callbacks = {};
		
		return {
			/**@
			* #Crafty.settings.register
			* @comp Crafty.settings
			* @sign public void Crafty.settings.register(String settingName, Function callback)
			* @param settingName - Name of the setting
			* @param callback - Function to execute when use modifies setting
			* Use this to register custom settings. Callback will be executed when `Crafty.settings.modify` is used.
			* @see Crafty.settings.modify
			*/
			register: function(setting, callback) {
				callbacks[setting] = callback;
			},
			
			/**@
			* #Crafty.settings.modify
			* @comp Crafty.settings
			* @sign public void Crafty.settings.modify(String settingName, * value)
			* @param settingName - Name of the setting
			* @param value - Value to set the setting to
			* Modify settings through this method.
			* @see Crafty.settings.register, Crafty.settings.get
			*/
			modify: function(setting, value) {
				if(!callbacks[setting]) return;
				callbacks[setting].call(states[setting], value);
				states[setting] = value;
			},
			
			/**@
			* #Crafty.settings.get
			* @comp Crafty.settings
			* @sign public * Crafty.settings.get(String settingName)
			* @param settingName - Name of the setting
			* @returns Current value of the setting
			* Returns the current value of the setting.
			* @see Crafty.settings.register, Crafty.settings.get
			*/
			get: function(setting) {
				return states[setting];
			}
		};
	})(),
	
	clone: clone
});

/**
* Return a unique ID
*/
function UID() {
	var id = GUID++;
	//if GUID is not unique
	if(id in entities) {
		return UID(); //recurse until it is unique
	}
	return id;
}

/**
* Clone an Object
*/
function clone(obj){
	if(obj === null || typeof(obj) != 'object')
		return obj;

	var temp = obj.constructor(); // changed

	for(var key in obj)
		temp[key] = clone(obj[key]);
	return temp;
}

Crafty.bind("Load", function() {
	if(!Crafty.support.setter && Crafty.support.defineProperty) {
		noSetter = [];
		Crafty.bind("EnterFrame", function() {
			var i = 0, l = noSetter.length, current;
			for(;i<l;++i) {
				current = noSetter[i];
				if(current.obj[current.prop] !== current.obj['_'+current.prop]) {
					current.fn.call(current.obj, current.obj[current.prop]);
				}
			}
		});
	}
});

//make Crafty global
window.Crafty = Crafty;
})(window);//wrap around components
(function(Crafty, window, document) {
/**@
* #Sprite
* @category Graphics
* Component for using tiles in a sprite map.
*/
Crafty.c("Sprite", {
	__image: '',
	__tile: 0,
	__tileh: 0,
	__padding: null,
	__trim: null,
	img: null,
	ready: false,
	
	init: function() {
		this.__trim = [0,0,0,0];
		
		var draw = function(e) {
			var co = e.co,
				pos = e.pos,
				context = e.ctx;
				
			if(e.type === "canvas") {
				//draw the image on the canvas element
				context.drawImage(this.img, //image element
								 co.x, //x position on sprite
								 co.y, //y position on sprite
								 co.w, //width on sprite
								 co.h, //height on sprite
								 pos._x, //x position on canvas
								 pos._y, //y position on canvas
								 pos._w, //width on canvas
								 pos._h //height on canvas
				);
			} else if(e.type === "DOM") {
				this._element.style.background = "url('" + this.__image + "') no-repeat -" + co.x + "px -" + co.y + "px";
			}
		};
		
		this.bind("Draw", draw).bind("RemoveComponent", function(id) {
			if(id === "Sprite") this.unbind("Draw", draw);  
		});
	},
	
	/**@
	* #.sprite
	* @comp Sprite
	* @sign public this .sprite(Number x, Number y, Number w, Number h)
	* @param x - X cell position 
	* @param y - Y cell position
	* @param w - Width in cells
	* @param h - Height in cells
	* Uses a new location on the sprite map as its sprite.
	*
	* Values should be in tiles or cells (not pixels).
	*/
	sprite: function(x,y,w,h) {
		this.__coord = [x * this.__tile + this.__padding[0] + this.__trim[0],
						y * this.__tileh + this.__padding[1] + this.__trim[1],
						this.__trim[2] || w * this.__tile || this.__tile,
						this.__trim[3] || h * this.__tileh || this.__tileh];
		
		this.trigger("Change");
		return this;
	},
	
	/**@
	* #.crop
	* @comp Sprite
	* @sign public this .crop(Number x, Number y, Number w, Number h)
	* @param x - Offset x position
	* @param y - Offset y position
	* @param w - New width
	* @param h - New height
	* If the entity needs to be smaller than the tile size, use this method to crop it.
	*
	* The values should be in pixels rather than tiles.
	*/
	crop: function(x,y,w,h) {
		var old = this._mbr || this.pos();
		this.__trim = [];
		this.__trim[0] = x;
		this.__trim[1] = y;
		this.__trim[2] = w;
		this.__trim[3] = h;
		
		this.__coord[0] += x;
		this.__coord[1] += y;
		this.__coord[2] = w;
		this.__coord[3] = h;
		this._w = w;
		this._h = h;
		
		this.trigger("Change", old);
		return this;
	},
});/**
* Spatial HashMap for broad phase collision
*
* @author Louis Stowasser
*/
(function(parent) {

var cellsize,
	HashMap = function(cell) {
		cellsize = cell || 64;
		this.map = {};
	},
	SPACE = " ";

HashMap.prototype = {
	insert: function(obj) {
		var keys = HashMap.key(obj),
			entry = new Entry(keys,obj,this),
			i = 0,
			j,
			hash;
			
		//insert into all x buckets
		for(i=keys.x1;i<=keys.x2;i++) {
			//insert into all y buckets
			for(j=keys.y1;j<=keys.y2;j++) {
				hash =  i + SPACE + j;
				if(!this.map[hash]) this.map[hash] = [];
				this.map[hash].push(obj);
			}
		}
		
		return entry;
	},
	
	search: function(rect,filter) {
		var keys = HashMap.key(rect),
			i,j,
			hash,
			results = [];
			
			if(filter === undefined) filter = true; //default filter to true
		
		//search in all x buckets
		for(i=keys.x1;i<=keys.x2;i++) {
			//insert into all y buckets
			for(j=keys.y1;j<=keys.y2;j++) {
				hash =  i + SPACE + j;
				
				if(this.map[hash]) {
					results = results.concat(this.map[hash]);
				}
			}
		}
		
		if(filter) {
			var obj, id, finalresult = [], found = {};
			//add unique elements to lookup table with the entity ID as unique key
			for(i=0,l=results.length;i<l;i++) {
				obj = results[i];
				if(!obj) continue; //skip if deleted
				id = obj[0]; //unique ID
				
				//check if not added to hash and that actually intersects
				if(!found[id] && obj.x < rect._x + rect._w && obj._x + obj._w > rect._x &&
								 obj.y < rect._y + rect._h && obj._h + obj._y > rect._y) 
				   found[id] = results[i];
			}
			
			//loop over lookup table and copy to final array
			for(obj in found) finalresult.push(found[obj]);
			
			return finalresult;
		} else {
			return results;
		}
	},
	
	remove: function(keys,obj) {
		var i = 0, j, hash;
			
		if(arguments.length == 1) {
			obj = keys;
			keys = HashMap.key(obj);
		}	
		
		//search in all x buckets
		for(i=keys.x1;i<=keys.x2;i++) {
			//insert into all y buckets
			for(j=keys.y1;j<=keys.y2;j++) {
				hash = i + SPACE + j;
				
				if(this.map[hash]) {
					var cell = this.map[hash], m = 0, n = cell.length;
					//loop over objs in cell and delete
					for(;m<n;m++) if(cell[m] && cell[m][0] === obj[0]) 
						cell.splice(m,1);
				}
			}
		}
	}
};

HashMap.key = function(obj) {
	if (obj.hasOwnProperty('mbr')) {
		obj = obj.mbr();
	}
	var x1 = ~~(obj._x / cellsize),
		y1 = ~~(obj._y / cellsize),
		x2 = ~~((obj._w + obj._x) / cellsize),
		y2 = ~~((obj._h + obj._y) / cellsize);
	return {x1: x1, y1: y1, x2: x2, y2: y2};
};

HashMap.hash = function(keys) {
	return keys.x1 + SPACE + keys.y1 + SPACE + keys.x2 + SPACE + keys.y2;
};

function Entry(keys,obj,map) {
	this.keys = keys;
	this.map = map;
	this.obj = obj;
}

Entry.prototype = {
	update: function(rect) {
		//check if buckets change
		if(HashMap.hash(HashMap.key(rect)) != HashMap.hash(this.keys)) {
			this.map.remove(this.keys, this.obj);
			var e = this.map.insert(this.obj);
			this.keys = e.keys;
		}
	}
};

parent.HashMap = HashMap;
})(Crafty);Crafty.map = new Crafty.HashMap();
var M = Math,
	Mc = M.cos,
	Ms = M.sin,
	PI = M.PI,
	DEG_TO_RAD = PI / 180;


/**@
* #2D
* @comp 2D
* Component for any entity that has a position on the stage.
*/
Crafty.c("2D", {
	/**@
	* #.x
	* The `x` position on the stage. When modified, will automatically be redrawn.
	* Is actually a getter/setter so when using this value for calculations and not modifying it,
	* use the `._x` property.
	*/
	_x: 0,
	/**@
	* #.y
	* The `y` position on the stage. When modified, will automatically be redrawn.
	* Is actually a getter/setter so when using this value for calculations and not modifying it,
	* use the `._y` property.
	*/
	_y: 0,
	/**@
	* #.w
	* The width of the entity. When modified, will automatically be redrawn.
	* Is actually a getter/setter so when using this value for calculations and not modifying it,
	* use the `._w` property.
	*
	* Changing this value is not recommended as canvas has terrible resize quality and DOM will just clip the image.
	*/
	_w: 0,
	/**@
	* #.x
	* The height of the entity. When modified, will automatically be redrawn.
	* Is actually a getter/setter so when using this value for calculations and not modifying it,
	* use the `._h` property.
	*
	* Changing this value is not recommended as canvas has terrible resize quality and DOM will just clip the image.
	*/
	_h: 0,
	/**@
	* #.z
	* The `z` index on the stage. When modified, will automatically be redrawn.
	* Is actually a getter/setter so when using this value for calculations and not modifying it,
	* use the `._z` property.
	*
	* A higher `z` value will be closer to the front of the stage. A smaller `z` value will be closer to the back.
	* A global Z index is produced based on its `z` value as well as the GID (which entity was created first).
	* Therefore entities will naturally maintain order depending on when it was created if same z value.
	*/
	_z: 0,
	/**@
	* #.rotation
	* Set the rotation of your entity. Rotation takes degrees in a clockwise direction.
	* It is important to note there is no limit on the rotation value. Setting a rotation 
	* mod 360 will give the same rotation without reaching huge numbers.
	*/
	_rotation: 0,
	/**@
	* #.alpha
	* Transparency of an entity. Must be a decimal value between 0.0 being fully transparent to 1.0 being fully opaque.
	*/
	_alpha: 1.0,
	/**@
	* #.visible
	* If the entity is visible or not. Accepts a true or false value.
	* Can be used for optimization by setting an entities visibility to false when not needed to be drawn.
	*
	* The entity will still exist and can be collided with but just won't be drawn.
	*/
	_visible: true,
	_global: null,
	
	_origin: null,
	_mbr: null,
	_entry: null,
	_children: null,
	_changed: false,
	
	init: function() {
		this._global = this[0];
		this._origin = {x: 0, y: 0};
		this._children = [];
		
		if(Crafty.support.setter) {
			//create getters and setters on x,y,w,h,z
			this.__defineSetter__('x', function(v) { this._attr('_x',v); });
			this.__defineSetter__('y', function(v) { this._attr('_y',v); });
			this.__defineSetter__('w', function(v) { this._attr('_w',v); });
			this.__defineSetter__('h', function(v) { this._attr('_h',v); });
			this.__defineSetter__('z', function(v) { this._attr('_z',v); });
			this.__defineSetter__('rotation', function(v) { this._attr('_rotation', v); });
			this.__defineSetter__('alpha', function(v) { this._attr('_alpha',v); });
			this.__defineSetter__('visible', function(v) { this._attr('_visible',v); });
			
			this.__defineGetter__('x', function() { return this._x; });
			this.__defineGetter__('y', function() { return this._y; });
			this.__defineGetter__('w', function() { return this._w; });
			this.__defineGetter__('h', function() { return this._h; });
			this.__defineGetter__('z', function() { return this._z; });
			this.__defineGetter__('rotation', function() { return this._rotation; });
			this.__defineGetter__('alpha', function() { return this._alpha; });
			this.__defineGetter__('visible', function() { return this._visible; });
			
		//IE9 supports Object.defineProperty
		} else if(Crafty.support.defineProperty) {
			
			Object.defineProperty(this, 'x', { set: function(v) { this._attr('_x',v); }, get: function() { return this._x; } });
			Object.defineProperty(this, 'y', { set: function(v) { this._attr('_y',v); }, get: function() { return this._y; } });
			Object.defineProperty(this, 'w', { set: function(v) { this._attr('_w',v); }, get: function() { return this._w; } });
			Object.defineProperty(this, 'h', { set: function(v) { this._attr('_h',v); }, get: function() { return this._h; } });
			Object.defineProperty(this, 'z', { set: function(v) { this._attr('_z',v); }, get: function() { return this._z; } });
			
			Object.defineProperty(this, 'rotation', { 
				set: function(v) { this._attr('_rotation',v); }, get: function() { return this._rotation; } 
			});
			
			Object.defineProperty(this, 'alpha', { 
				set: function(v) { this._attr('_alpha',v); }, get: function() { return this._alpha; } 
			});
			
			Object.defineProperty(this, 'visible', { 
				set: function(v) { this._attr('_visible',v); }, get: function() { return this._visible; } 
			});
			
		} else {
			/*
			if no setters, check on every frame for a difference 
			between this._(x|y|w|h|z...) and this.(x|y|w|h|z)
			*/
			
			//set the public properties to the current private properties
			this.x = this._x;
			this.y = this._y;
			this.w = this._w;
			this.h = this._h;
			this.z = this._z;
			this.rotation = this._rotation;
			this.alpha = this._alpha;
			this.visible = this._visible;
			
			//on every frame check for a difference in any property
			this.bind("EnterFrame", function() {
				//if there are differences between the public and private properties
				if(this.x !== this._x || this.y !== this._y ||
				   this.w !== this._w || this.h !== this._h ||
				   this.z !== this._z || this.rotation !== this._rotation ||
				   this.alpha !== this._alpha || this.visible !== this._visible) {
					
					//save the old positions
					var old = this.mbr() || this.pos();
					
					//if rotation has changed, use the private rotate method
					if(this.rotation !== this._rotation) {
						this._rotate(this.rotation);
					} else {
						//update the MBR
						var mbr = this._mbr, moved = false;
						if(mbr) { //check each value to see which has changed
							if(this.x !== this._x) { mbr._x -= this.x - this._x; moved = true; }
							else if(this.y !== this._y) { mbr._y -= this.y - this._y; moved = true; }
							else if(this.w !== this._w) { mbr._w -= this.w - this._w; moved = true; }
							else if(this.h !== this._h) { mbr._h -= this.h - this._h; moved = true; }
							else if(this.z !== this._z) { mbr._z -= this.z - this._z; moved = true; }
						}
						
						//if the moved flag is true, trigger a move
						if(moved) this.trigger("Move", old);
					}
					
					//set the public properties to the private properties
					this._x = this.x;
					this._y = this.y;
					this._w = this.w;
					this._h = this.h;
					this._z = this.z;
					this._rotation = this.rotation;
					this._alpha = this.alpha;
					this._visible = this.visible;

					//trigger the changes
					this.trigger("Change", old);
					//without this entities weren't added correctly to Crafty.map.map in IE8.
					//not entirely sure this is the best way to fix it though
					this.trigger("Move", old);
				}
			});
		}
		
		//insert self into the HashMap
		this._entry = Crafty.map.insert(this);
		
		//when object changes, update HashMap
		this.bind("Move", function(e) {
			var area = this._mbr || this;
			this._entry.update(area);
			this._cascade(e);
		});
		
		this.bind("Rotate", function(e) {
			var old = this._mbr || this;
			this._entry.update(old);
			this._cascade(e);
		});
		
		//when object is removed, remove from HashMap
		this.bind("Remove", function() {
			Crafty.map.remove(this);
			
			this.detach();
		});
	},
	
	/**
	* Calculates the MBR when rotated with an origin point
	*/
	_rotate: function(v) {
		var theta = -1 * (v % 360), //angle always between 0 and 359
			rad = theta * DEG_TO_RAD,
			ct = Math.cos(rad), //cache the sin and cosine of theta
			st = Math.sin(rad),
			o = {x: this._origin.x + this._x, 
				 y: this._origin.y + this._y}; 
		
		//if the angle is 0 and is currently 0, skip
		if(!theta) {
			this._mbr = null;
			if(!this._rotation % 360) return;
		}
		
		var x0 = o.x + (this._x - o.x) * ct + (this._y - o.y) * st,
			y0 = o.y - (this._x - o.x) * st + (this._y - o.y) * ct,
			x1 = o.x + (this._x + this._w - o.x) * ct + (this._y - o.y) * st,
			y1 = o.y - (this._x + this._w - o.x) * st + (this._y - o.y) * ct,
			x2 = o.x + (this._x + this._w - o.x) * ct + (this._y + this._h - o.y) * st,
			y2 = o.y - (this._x + this._w - o.x) * st + (this._y + this._h - o.y) * ct,
			x3 = o.x + (this._x - o.x) * ct + (this._y + this._h - o.y) * st,
			y3 = o.y - (this._x - o.x) * st + (this._y + this._h - o.y) * ct,
			minx = Math.floor(Math.min(x0,x1,x2,x3)),
			miny = Math.floor(Math.min(y0,y1,y2,y3)),
			maxx = Math.ceil(Math.max(x0,x1,x2,x3)),
			maxy = Math.ceil(Math.max(y0,y1,y2,y3));
			
		this._mbr = {_x: minx, _y: miny, _w: maxx - minx, _h: maxy - miny};
		
		//trigger rotation event
		var difference = this._rotation - v,
			drad = difference * DEG_TO_RAD;
			
		this.trigger("Rotate", {
			cos: Math.cos(drad), 
			sin: Math.sin(drad), 
			deg: difference, 
			rad: drad, 
			o: {x: o.x, y: o.y},
			matrix: {M11: ct, M12: st, M21: -st, M22: ct}
		});
	},
	
	/**@
	* #.area
	* @comp 2D
	* @sign public Number .area(void)
	* Calculates the area of the entity
	*/
	area: function() {
		return this._w * this._h;
	},
	
	/**@
	* #.intersect
	* @comp 2D
	* @sign public Boolean .intersect(Number x, Number y, Number w, Number h)
	* @param x - X position of the rect
	* @param y - Y position of the rect
	* @param w - Width of the rect
	* @param h - Height of the rect
	* @sign public Boolean .intersect(Object rect)
	* @param rect - An object that must have the `x, y, w, h` values as properties
	* Determines if this entity intersects a rectangle.
	*/
	intersect: function(x,y,w,h) {
		var rect, obj = this._mbr || this;
		if(typeof x === "object") {
			rect = x;
		} else {
			rect = {x: x, y: y, w: w, h: h};
		}
		
		return obj._x < rect.x + rect.w && obj._x + obj._w > rect.x &&
			   obj._y < rect.y + rect.h && obj._h + obj._y > rect.y;
	},
	
	/**@
	* #.within
	* @comp 2D
	* @sign public Boolean .within(Number x, Number y, Number w, Number h)
	* @param x - X position of the rect
	* @param y - Y position of the rect
	* @param w - Width of the rect
	* @param h - Height of the rect
	* @sign public Boolean .within(Object rect)
	* @param rect - An object that must have the `x, y, w, h` values as properties
	* Determines if this current entity is within another rectangle.
	*/
	within: function(x,y,w,h) {
		var rect;
		if(typeof x === "object") {
			rect = x;
		} else {
			rect = {x: x, y: y, w: w, h: h};
		}
		
		return rect.x <= this.x && rect.x + rect.w >= this.x + this.w &&
				rect.y <= this.y && rect.y + rect.h >= this.y + this.h;
	},
	
	/**@
	* #.contains
	* @comp 2D
	* @sign public Boolean .contains(Number x, Number y, Number w, Number h)
	* @param x - X position of the rect
	* @param y - Y position of the rect
	* @param w - Width of the rect
	* @param h - Height of the rect
	* @sign public Boolean .contains(Object rect)
	* @param rect - An object that must have the `x, y, w, h` values as properties
	* Determines if the rectangle is within the current entity.
	*/
	contains: function(x,y,w,h) {
		var rect;
		if(typeof x === "object") {
			rect = x;
		} else {
			rect = {x: x, y: y, w: w, h: h};
		}
		
		return rect.x >= this.x && rect.x + rect.w <= this.x + this.w &&
				rect.y >= this.y && rect.y + rect.h <= this.y + this.h;
	},
	
	/**@
	* #.pos
	* @comp 2D
	* @sign public Object .pos(void)
	* Returns the x, y, w, h properties as a rect object 
	* (a rect object is just an object with the keys _x, _y, _w, _h).
	*
	* The keys have an underscore prefix. This is due to the x, y, w, h 
	* properties being merely setters and getters that wrap the properties with an underscore (_x, _y, _w, _h).
	*/
	pos: function() {
		return {
			_x: (this._x),
			_y: (this._y),
			_w: (this._w),
			_h: (this._h)
		};
	},
	
	/**
	* Returns the minimum bounding rectangle. If there is no rotation
	* on the entity it will return the rect.
	*/
	mbr: function() {
		if(!this._mbr) return this.pos();
		return {
			_x: (this._mbr._x),
			_y: (this._mbr._y),
			_w: (this._mbr._w),
			_h: (this._mbr._h)
		};
	},
	
	/**@
	* #.isAt
	* @comp 2D
	* @sign public Boolean .isAt(Number x, Number y)
	* @param x - X position of the point
	* @param y - Y position of the point
	* Determines whether a point is contained by the entity. Unlike other methods, 
	* an object can't be passed. The arguments require the x and y value
	*/
	isAt: function(x,y) {
		if(this.map) {
			return this.map.containsPoint(x,y);
		}
		return this.x <= x && this.x + this.w >= x &&
			   this.y <= y && this.y + this.h >= y;
	},
	
	/**@
	* #.move
	* @comp 2D
	* @sign public this .move(String dir, Number by)
	* @param dir - Direction to move (n,s,e,w,ne,nw,se,sw)
	* @param by - Amount to move in the specified direction
	* Quick method to move the entity in a direction (n, s, e, w, ne, nw, se, sw) by an amount of pixels.
	*/
	move: function(dir, by) {
		if(dir.charAt(0) === 'n') this.y -= by;
		if(dir.charAt(0) === 's') this.y += by;
		if(dir === 'e' || dir.charAt(1) === 'e') this.x += by;
		if(dir === 'w' || dir.charAt(1) === 'w') this.x -= by;
		
		return this;
	},
	
	/**@
	* #.shift
	* @comp 2D
	* @sign public this .shift(Number x, Number y, Number w, Number h)
	* @param x - Amount to move X 
	* @param y - Amount to move Y
	* @param w - Amount to widen
	* @param h - Amount to increase height
	* Shift or move the entity by an amount. Use negative values
	* for an opposite direction.
	*/
	shift: function(x,y,w,h) {
		if(x) this.x += x;
		if(y) this.y += y;
		if(w) this.w += w;
		if(h) this.h += h;
		
		return this;
	},
	
	/**
	* Move or rotate all the children for this entity
	*/
	_cascade: function(e) {
		if(!e) return; //no change in position
		var i = 0, children = this._children, l = children.length, obj;
		//rotation
		if(e.cos) {
			for(;i<l;++i) {
				obj = children[i];
				if('rotate' in obj) obj.rotate(e);
			}
		} else {
			//use MBR or current
			var rect = this._mbr || this,
				dx = rect._x - e._x,
				dy = rect._y - e._y,
				dw = rect._w - e._w,
				dh = rect._h - e._h;
			
			for(;i<l;++i) {
				obj = children[i];
				obj.shift(dx,dy,dw,dh);
			}
		}
	},
	
	/**
	* #.attach
	* @comp 2D
	* @sign public this .attach(Entity obj[, .., Entity objN])
	* @param obj - Entity(s) to attach
	* Attaches an entities position and rotation to current entity. When the current entity moves, 
	* the attached entity will move by the same amount.
	*
	* As many objects as wanted can be attached and a hierarchy of objects is possible by attaching.
	*/
	attach: function() {
		var i = 0, arg = arguments, l = arguments.length, obj;
		for(;i<l;++i) {
			obj = arg[i];
			this._children.push(obj);
		}
		
		return this;
	},
	
	/**@
	* #.detach
	* @comp 2D
	* @sign public this .detach([Entity obj])
	* @param obj - The entity to detach. Left blank will remove all attached entities
	* Stop an entity from following the current entity. Passing no arguments will stop
	* every entity attached.
	*/
	detach: function(obj) {
		//if nothing passed, remove all attached objects
		if(!obj) {
			this._children = [];
			return this;
		}
		//if obj passed, find the handler and unbind
    for (var i = 0; i < this._children.length; i++) {
			if (this._children[i] == obj) {
				this._children.splice(i, 1);
			}
		}
		
		return this;
	},
	
	/**@
	* #.origin
	* @comp 2D
	* @sign public this .origin(Number x, Number y)
	* @param x - Pixel value of origin offset on the X axis
	* @param y - Pixel value of origin offset on the Y axis
	* @sign public this .origin(String offset)
	* @param offset - Combination of center, top, bottom, middle, left and right
	* Set the origin point of an entity for it to rotate around. 
	* @example
	* ~~~
	* this.origin("top left")
	* this.origin("center")
	* this.origin("bottom right")
	* this.origin("middle right")
	* ~~~
	* @see .rotation
	*/
	origin: function(x,y) {
		//text based origin
		if(typeof x === "string") {
			if(x === "centre" || x === "center" || x.indexOf(' ') === -1) {
				x = this._w / 2;
				y = this._h / 2;
			} else {
				var cmd = x.split(' ');
				if(cmd[0] === "top") y = 0;
				else if(cmd[0] === "bottom") y = this._h;
				else if(cmd[0] === "middle" || cmd[1] === "center" || cmd[1] === "centre") y = this._h / 2;
				
				if(cmd[1] === "center" || cmd[1] === "centre" || cmd[1] === "middle") x = this._w / 2;
				else if(cmd[1] === "left") x = 0;
				else if(cmd[1] === "right") x = this._w;
			}
		}
		
		this._origin.x = x;
		this._origin.y = y;
		
		return this;
	},
	
	flip: function(dir) {
		dir = dir || "X";
		this["_flip"+dir] = true;
		this.trigger("Change");
	},
	
	/**
	* Method for rotation rather than through a setter
	*/
	rotate: function(e) {
		//assume event data origin
		this._origin.x = e.o.x - this._x;
		this._origin.y = e.o.y - this._y;
		
		//modify through the setter method
		this._attr('_rotation', e.theta);
	},
	
	/**
	* Setter method for all 2D properties including 
	* x, y, w, h, alpha, rotation and visible.
	*/
	_attr: function(name,value) {	
		//keep a reference of the old positions
		var pos = this.pos(),
			old = this.mbr() || pos;
		
		//if rotation, use the rotate method
		if(name === '_rotation') {
			this._rotate(value);
		//set the global Z and trigger reorder just incase
		} else if(name === '_z') {
			this._global = parseInt(value + Crafty.zeroFill(this[0], 5), 10); //magic number 10e5 is the max num of entities
			this.trigger("reorder");
		//if the rect bounds change, update the MBR and trigger move
		} else if(name == '_x' || name === '_y' || name === '_w' || name === '_h') {
			var mbr = this._mbr;
			if(mbr) {
				mbr[name] -= this[name] - value;
			}
			this[name] = value;
			this.trigger("Move", old);
		}
		
		//everything will assume the value
		this[name] = value;
		
		//trigger a change
		this.trigger("Change", old);
	}
});

Crafty.c("Physics", {
	_gravity: 0.4,
	_friction: 0.2,
	_bounce: 0.5,
	
	gravity: function(gravity) {
		this._gravity = gravity;
	}
});

Crafty.c("Gravity", {
	_gravity: 0.2,
	_gy: 0,
	_falling: true,
	_anti: null,

	init: function() {
		this.requires("2D");		
	},

	gravity: function(comp) {
		if(comp) this._anti = comp;

		this.bind("EnterFrame", this._enterframe);

		return this;
	},

	_enterframe: function() {
		if(this._falling) {
			//if falling, move the players Y
			this._gy += this._gravity * 2;
			this.y += this._gy;
		} else {
			this._gy = 0; //reset change in y
		}

		var obj, hit = false, pos = this.pos(),
			q, i = 0, l;

		//Increase by 1 to make sure map.search() finds the floor
		pos._y++;

		//map.search wants _x and intersect wants x...
		pos.x = pos._x;
		pos.y = pos._y;
		pos.w = pos._w;
		pos.h = pos._h;

		q = Crafty.map.search(pos);
		l = q.length;

		for(;i<l;++i) {
			obj = q[i];
			//check for an intersection directly below the player
			if(obj !== this && obj.has(this._anti) && obj.intersect(pos)) {
				hit = obj;
				break;
			}
		}

		if(hit) { //stop falling if found
			if(this._falling) this.stopFalling(hit);
		} else {
			this._falling = true; //keep falling otherwise
		}
	},

	stopFalling: function(e) {
		if(e) this.y = e._y - this._h ; //move object

		//this._gy = -1 * this._bounce;
		this._falling = false;
		if(this._up) this._up = false;
		this.trigger("hit");
	},

	antigravity: function() {
		this.unbind("EnterFrame", this._enterframe);
	}
});

/**@
* #Crafty.Polygon
* @category 2D
* Polygon object used for hitboxes and click maps. Must pass an Array for each point as an 
* argument where index 0 is the x position and index 1 is the y position.
*
* For example one point of a polygon will look like this: `[0,5]` where the `x` is `0` and the `y` is `5`.
*
* Can pass an array of the points or simply put each point as an argument.
*
* When creating a polygon for an entity, each point should be offset or relative from the entities `x` and `y` 
* (don't include the absolute values as it will automatically calculate this).
*/
Crafty.polygon = function(poly) {
	if(arguments.length > 1) {
		poly = Array.prototype.slice.call(arguments, 0);
	}
	this.points = poly;
};

Crafty.polygon.prototype = {
	/**@
	* #.containsPoint
	* @comp Crafty.Polygon
	* @sign public Boolean .containsPoint(Number x, Number y)
	* @param x - X position of the point
	* @param y - Y position of the point
	* Method is used to determine if a given point is contained by the polygon.
	* @example
	* ~~~
	* var poly = new Crafty.polygon([50,0],[100,100],[0,100]);
	* poly.containsPoint(50, 50); //TRUE
	* poly.containsPoint(0, 0); //FALSE
	* ~~~
	*/
	containsPoint: function(x, y) {
		var p = this.points, i, j, c = false;

		for (i = 0, j = p.length - 1; i < p.length; j = i++) {
			if (((p[i][1] > y) != (p[j][1] > y)) && (x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0])) {
				c = !c;
			}
		}

		return c;
	},
	
	/**@
	* #.shift
	* @comp Crafty.Polygon
	* @sign public void .shift(Number x, Number y)
	* @param x - Amount to shift the `x` axis
	* @param y - Amount to shift the `y` axis
	* Shifts every single point in the polygon by the specified amount.
	* @example
	* ~~~
	* var poly = new Crafty.polygon([50,0],[100,100],[0,100]);
	* poly.shift(5,5);
	* //[[55,5], [105,5], [5,105]];
	* ~~~
	*/
	shift: function(x,y) {
		var i = 0, l = this.points.length, current;
		for(;i<l;i++) {
			current = this.points[i];
			current[0] += x;
			current[1] += y;
		}
	},
	
	rotate: function(e) {
		var i = 0, l = this.points.length, 
			current, x, y;
			
		for(;i<l;i++) {
			current = this.points[i];
			
			x = e.o.x + (current[0] - e.o.x) * e.cos + (current[1] - e.o.y) * e.sin;
			y = e.o.y - (current[0] - e.o.x) * e.sin + (current[1] - e.o.y) * e.cos;
			
			current[0] = Math.floor(x);
			current[1] = Math.floor(y);
		}
	}
};

/**@
* #Crafty.Circle
* @category 2D
* Circle object used for hitboxes and click maps. Must pass a `x`, a `y` and a `radius` value.
*
* ~~~
* var centerX = 5,
*     centerY = 10,
*     radius = 25;
*
* new Crafty.circle(centerX, centerY, radius);
* ~~~
*
* When creating a circle for an entity, each point should be offset or relative from the entities `x` and `y` 
* (don't include the absolute values as it will automatically calculate this).
*/
Crafty.circle = function(x, y, radius) {
	this.x = x;
	this.y = y;
	this.radius = radius;
	
	// Creates an octogon that aproximate the circle for backward compatibility.
	this.points = [];
	var theta;
	
	for(var i = 0; i < 8; i++) {
		theta = i * Math.PI / 4;
		this.points[i] = [Math.sin(theta) * radius, Math.cos(theta) * radius];
	}
};

Crafty.circle.prototype = {
	/**@
	* #.containsPoint
	* @comp Crafty.Circle
	* @sign public Boolean .containsPoint(Number x, Number y)
	* @param x - X position of the point
	* @param y - Y position of the point
	* Method is used to determine if a given point is contained by the circle.
	* @example
	* ~~~
	* var circle = new Crafty.circle(0, 0, 10);
	* circle.containsPoint(0, 0); //TRUE
	* circle.containsPoint(50, 50); //FALSE
	* ~~~
	*/
	containsPoint: function(x, y) {
		var radius = this.radius,
		    sqrt = Math.sqrt,
		    deltaX = this.x - x,
		    deltaY = this.y - y;

		return (deltaX * deltaX + deltaY * deltaY) < (radius * radius);
	},
	
	/**@
	* #.shift
	* @comp Crafty.Circle
	* @sign public void .shift(Number x, Number y)
	* @param x - Amount to shift the `x` axis
	* @param y - Amount to shift the `y` axis
	* Shifts the circle by the specified amount.
	* @example
	* ~~~
	* var poly = new Crafty.circle(0, 0, 10);
	* circle.shift(5,5);
	* //{x: 5, y: 5, radius: 10};
	* ~~~
	*/
	shift: function(x,y) {
		this.x += x;
		this.y += y;
		
		var i = 0, l = this.points.length, current;
		for(;i<l;i++) {
			current = this.points[i];
			current[0] += x;
			current[1] += y;
		}
	},
	
	rotate: function() {
		// We are a circle, we don't have to rotate :)
	}
};


Crafty.matrix = function(m) {
	this.mtx = m;
	this.width = m[0].length;
	this.height = m.length;
};

Crafty.matrix.prototype = {
	x: function(other) {
		if (this.width != other.height) {
			return;
		}
	 
		var result = [];
		for (var i = 0; i < this.height; i++) {
			result[i] = [];
			for (var j = 0; j < other.width; j++) {
				var sum = 0;
				for (var k = 0; k < this.width; k++) {
					sum += this.mtx[i][k] * other.mtx[k][j];
				}
				result[i][j] = sum;
			}
		}
		return new Crafty.matrix(result); 
	},
	
	
	e: function(row, col) {
		//test if out of bounds
		if(row < 1 || row > this.mtx.length || col < 1 || col > this.mtx[0].length) return null;
		return this.mtx[row - 1][col - 1];
	}
}/**@
* #Collision
* @category 2D
* Component to detect collision between any two convex polygons.
*/
Crafty.c("Collision", {
	
    init: function() {
        this.requires("2D");
    },
    
	/**@
	* #.collision
	* @comp Collision
	* @sign public this .collision([Crafty.Polygon polygon])
	* @param polygon - Crafty.Polygon object that will act as the hit area
	* Constructor takes a polygon to use as the hit area. If left empty, 
	* will create a rectangle polygon based on the x, y, w, h dimensions.
	*
	* This must be called before any .hit() or .onhit() methods.
	*
	* The hit area (polygon) must be a convex shape and not concave 
	* for the collision detection to work.
	* @example
	* ~~~
	* this.collision(
	*     new Crafty.polygon([50,0], [100,100], [0,100])
	* );
	* ~~~
	* @see Crafty.Polygon
	*/
	collision: function(poly) {
		var area = this._mbr || this;
		
		//if no polygon presented, create a square
		if(!poly) {
			poly = new Crafty.polygon([0,0],[area._w,0],[area._w,area._h],[0,area._h]);
		}
		this.map = poly;
		this.attach(this.map);
		this.map.shift(area._x, area._y);
		
		return this;
	},
	
	/**@
	* #.hit
	* @comp Collision
	* @sign public Boolean/Array hit(String component)
	* @param component - Check collision with entities that has this component
	* @return `false` if no collision. If a collision is detected, returns an Array of objects that are colliding.
	* Takes an argument for a component to test collision for. If a collision is found, an array of 
	* every object in collision along with the amount of overlap is passed.
	*
	* If no collision, will return false. The return collision data will be an Array of Objects with the 
	* type of collision used, the object collided and if the type used was SAT (a polygon was used as the hitbox) then an amount of overlap.
	* ~~~
	* [{
	*    obj: [entity],
	*    type "MBR" or "SAT",
	*    overlap: [number]
	* }]
	* ~~~
	* `MBR` is your standard axis aligned rectangle intersection (`.intersect` in the 2D component). 
	* `SAT` is collision between any convex polygon.
	* @see .onHit, 2D
	*/
	hit: function(comp) {
		var area = this._mbr || this,
			results = Crafty.map.search(area, false),
			i = 0, l = results.length,
			dupes = {},
			id, obj, oarea, key,
			hasMap = ('map' in this && 'containsPoint' in this.map),
			finalresult = [];
		
		if(!l) {
			return false;
		}
		
		for(;i<l;++i) {
			obj = results[i];
			oarea = obj._mbr || obj; //use the mbr
			
			if(!obj) continue;
			id = obj[0];
			
			//check if not added to hash and that actually intersects
			if(!dupes[id] && this[0] !== id && obj.__c[comp] && 
							 oarea._x < area._x + area._w && oarea._x + oarea._w > area._x &&
							 oarea._y < area._y + area._h && oarea._h + oarea._y > area._y) 
			   dupes[id] = obj;
		}
		
		for(key in dupes) {
			obj = dupes[key];

			if(hasMap && 'map' in obj) {
				var SAT = this._SAT(this.map, obj.map);
				SAT.obj = obj;
				SAT.type = "SAT";
				if(SAT) finalresult.push(SAT);
			} else {
				finalresult.push({obj: obj, type: "MBR"});
			}
		}
		
		if(!finalresult.length) {
			return false;
		}
		
		return finalresult;
	},
	
	/**@
	* #.onHit
	* @comp Collision
	* @sign public this .onHit(String component, Function hit[, Function noHit])
	* @param component - Component to check collisions for
	* @param hit - Callback method to execute when collided with component
	* @param noHit - Callback method executed once as soon as collision stops
	* Creates an enterframe event calling .hit() each time and if collision detected will invoke the callback.
	* @see .hit
	*/
	onHit: function(comp, fn, fnOff) {
		var justHit = false;
		this.bind("EnterFrame", function() {
			var hitdata = this.hit(comp);
			if(hitdata) {
				justHit = true;
				fn.call(this, hitdata);
			} else if(justHit) {
				if (typeof fnOff == 'function') {
					fnOff.call(this);
				}
				justHit = false;
			}
		});
		return this;
	},
	
	_SAT: function(poly1, poly2) {
		var points1 = poly1.points,
			points2 = poly2.points,
			i = 0, l = points1.length,
			j, k = points2.length,
			normal = {x: 0, y: 0},
			length,
			min1, min2,
			max1, max2,
			interval,
			MTV = null,
      MTV2 = 0,
      MN = null,
			dot,
			nextPoint,
			currentPoint;
		
		//loop through the edges of Polygon 1
		for(;i<l;i++) {
			nextPoint = points1[(i==l-1 ? 0 : i+1)];
			currentPoint = points1[i];
			
			//generate the normal for the current edge
			normal.x = -(nextPoint[1] - currentPoint[1]);
			normal.y = (nextPoint[0] - currentPoint[0]);
			
			//normalize the vector
			length = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
			normal.x /= length;
			normal.y /= length;
			
			//default min max
			min1 = min2 = -1;
			max1 = max2 = -1;
			
			//project all vertices from poly1 onto axis
			for(j = 0; j < l; ++j) {
				dot = points1[j][0] * normal.x + points1[j][1] * normal.y;
				if(dot > max1 || max1 === -1) max1 = dot;
				if(dot < min1 || min1 === -1) min1 = dot;
			}
			
			//project all vertices from poly2 onto axis
			for(j = 0; j < k; ++j) {
				dot = points2[j][0] * normal.x + points2[j][1] * normal.y;
				if(dot > max2 || max2 === -1) max2 = dot;
				if(dot < min2 || min2 === -1) min2 = dot;
			}
			
			//calculate the minimum translation vector should be negative
			interval = (min1 < min2) ? min2 - max1 : min1 - max2;
			
			//exit early if positive
			if(interval > 0) {
				return false;
			}
			if(interval > MTV || MTV === null) MTV = interval;
		}
		
		//loop through the edges of Polygon 1
		for(i=0;i<k;i++) {
			nextPoint = points2[(i==k-1 ? 0 : i+1)];
			currentPoint = points2[i];
			
			//generate the normal for the current edge
			normal.x = -(nextPoint[1] - currentPoint[1]);
			normal.y = (nextPoint[0] - currentPoint[0]);
			
			//normalize the vector
			length = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
			normal.x /= length;
			normal.y /= length;
			
			//default min max
			min1 = min2 = -1;
			max1 = max2 = -1;
			
			//project all vertices from poly1 onto axis
			for(j = 0; j < l; ++j) {
				dot = points1[j][0] * normal.x + points1[j][1] * normal.y;
				if(dot > max1 || max1 === -1) max1 = dot;
				if(dot < min1 || min1 === -1) min1 = dot;
			}
			
			//project all vertices from poly2 onto axis
			for(j = 0; j < k; ++j) {
				dot = points2[j][0] * normal.x + points2[j][1] * normal.y;
				if(dot > max2 || max2 === -1) max2 = dot;
				if(dot < min2 || min2 === -1) min2 = dot;
			}
			
			//calculate the minimum translation vector should be negative
			interval = (min1 < min2) ? min2 - max1 : min1 - max2;
			
			//exit early if positive
			if(interval > 0) {
				return false;
			}
			if(interval > MTV || MTV === null) MTV = interval;
      if (interval < MTV2) {
        MTV2 = interval;
        MN = {x: normal.x, y: normal.y};
      }
		}
		
		return {overlap: MTV, normal: MN};
	}
});
/**@
* #DOM
* @category Graphics
* Draws entities as DOM nodes, specifically `<DIV>`s.
*/
Crafty.c("DOM", {
	/**@
	* #._element
	* @comp DOM
	* The DOM element used to represent the entity.
	*/
	_element: null,

	init: function() {
		this._element = document.createElement("div");
		Crafty.stage.inner.appendChild(this._element);
		this._element.style.position = "absolute";
		this._element.id = "ent" + this[0];
		
		this.bind("Change", function() {
			if(!this._changed) {
				this._changed = true;
				Crafty.DrawManager.add(this);
			}
		});
		
		function updateClass() {
			var i = 0, c = this.__c, str = "";
			for(i in c) {
				str += ' ' + i;
			}
			str = str.substr(1);
			this._element.className = str;
		}
		
		this.bind("NewComponent", updateClass).bind("RemoveComponent", updateClass);
		
		if(Crafty.support.prefix === "ms" && Crafty.support.version < 9) {
			this._filters = {};
			
			this.bind("Rotate", function(e) {
				var m = e.matrix,
					elem = this._element.style,
					M11 = m.M11.toFixed(8),
					M12 = m.M12.toFixed(8),
					M21 = m.M21.toFixed(8),
					M22 = m.M22.toFixed(8);
				
				this._filters.rotation = "progid:DXImageTransform.Microsoft.Matrix(M11="+M11+", M12="+M12+", M21="+M21+", M22="+M22+",sizingMethod='auto expand')";
			});
		}
		
		this.bind("Remove", this.undraw);
	},
	
	/**@
	* #.DOM
	* @comp DOM
	* @sign public this .DOM(HTMLElement elem)
	* @param elem - HTML element that will replace the dynamically created one
	* Pass a DOM element to use rather than one created. Will set `._element` to this value. Removes the old element.
	*/
	DOM: function(elem) {
		if(elem && elem.nodeType) {
			this.undraw();
			this._element = elem;
			this._element.style.position = 'absolute';
		}
		return this;
	},
	
	/**@
	* #.draw
	* @comp DOM
	* @sign public this .draw(void)
	* @triggers Draw
	* Updates the CSS properties of the node to draw on the stage.
	*/
	draw: function() {
		var style = this._element.style,
			coord = this.__coord || [0,0,0,0],
			co = {x: coord[0], y: coord[1] },
			prefix = Crafty.support.prefix,
			trans = [];
		
		if(!this._visible) style.visibility = "hidden";
		else style.visibility = "visible";
		
/*<<<<<<< HEAD
		//utilize CSS3 if supported
		if(Crafty.support.css3dtransform) {
			trans.push("translate3d("+(~~this._x)+"px,"+(~~this._y)+"px,0)");
		} else {
			style.left = ~~(this._x) + "px";
			style.top = ~~(this._y) + "px";
		}
		
=======*/
		if(Crafty.support.css3dtransform) trans.push("translate3d("+(~~this._x)+"px,"+(~~this._y)+"px,0)");
		else {
			style.top = Number(this._y)+"px";
			style.left = Number(this._x)+"px";
			//trans.push("translate("+(~~this._x)+"px,"+(~~this._y)+"px,0)");
		}
//>>>>>>> 48ba1ac29df667845aac2e829f6024c0603a4ea6
		style.width = ~~(this._w) + "px";
		style.height = ~~(this._h) + "px";
		style.zIndex = this._z;
		
		style.opacity = this._alpha;
		style[prefix+"Opacity"] = this._alpha;
		
		//if not version 9 of IE
		if(prefix === "ms" && Crafty.support.version < 9) {
			//for IE version 8, use ImageTransform filter
			if(Crafty.support.version === 8) {
				this._filters.alpha = "progid:DXImageTransform.Microsoft.Alpha(Opacity="+(this._alpha * 100)+")"; // first!
			//all other versions use filter
			} else {
				this._filters.alpha = "alpha(opacity="+(this._alpha*100)+")";
			}
		}
		
		if(this._mbr) {
			var origin = this._origin.x + "px " + this._origin.y + "px";
			style.transformOrigin = origin;
			style[prefix+"TransformOrigin"] = origin;
			if(Crafty.support.css3dtransform) trans.push("rotateZ("+this._rotation+"deg)");
			else trans.push("rotate("+this._rotation+"deg)");
		}
		
		if(this._flipX) {
			trans.push("scaleX(-1)");
			if(prefix === "ms" && Crafty.support.version < 9) {
				this._filters.flipX = "fliph";
			}
		}
		
		if(this._flipY) {
			trans.push("scaleY(-1)");
			if(prefix === "ms" && Crafty.support.version < 9) {
				this._filters.flipY = "flipv";
			}
		}
		
		//apply the filters if IE
		if(prefix === "ms" && Crafty.support.version < 9) {
			this.applyFilters();
		}
		
		style.transform = trans.join(" ");
		style[prefix+"Transform"] = trans.join(" ");
		
		this.trigger("Draw", {style: style, type: "DOM", co: co});
		
		return this;
	},
	
	applyFilters: function() {
		this._element.style.filter = "";
		var str = "";
		
		for(var filter in this._filters) {
			if(!this._filters.hasOwnProperty(filter)) continue;
			str += this._filters[filter] + " ";
		}
		
		this._element.style.filter = str;
	},
	
	/**@
	* #.undraw
	* @comp DOM
	* @sign public this .undraw(void)
	* Removes the element from the stage.
	*/
	undraw: function() {
		Crafty.stage.inner.removeChild(this._element);
		return this;
	},
	
	/**@
	* #.css
	* @sign public * css(String property, String value)
	* @param property - CSS property to modify
	* @param value - Value to give the CSS property
	* @sign public * css(Object map)
	* @param map - Object where the key is the CSS property and the value is CSS value
	* Apply CSS styles to the element. 
	*
	* Can pass an object where the key is the style property and the value is style value.
	*
	* For setting one style, simply pass the style as the first argument and the value as the second.
	*
	* The notation can be CSS or JS (e.g. `text-align` or `textAlign`).
	*
	* To return a value, pass the property.
	* @example
	* ~~~
	* this.css({'text-align', 'center', font: 'Arial'});
	* this.css("textAlign", "center");
	* this.css("text-align"); //returns center
	* ~~~
	*/
	css: function(obj, value) {
		var key,
			elem = this._element, 
			val,
			style = elem.style;
		
		//if an object passed
		if(typeof obj === "object") {
			for(key in obj) {
				if(!obj.hasOwnProperty(key)) continue;
				val = obj[key];
				if(typeof val === "number") val += 'px';
				
				style[Crafty.DOM.camelize(key)] = val;
			}
		} else {
			//if a value is passed, set the property
			if(value) {
				if(typeof value === "number") value += 'px';
				style[Crafty.DOM.camelize(obj)] = value;
			} else { //otherwise return the computed property
				return Crafty.DOM.getStyle(elem, obj);
			}
		}
		
		this.trigger("Change");
		
		return this;
	}
});

/**
* Fix IE6 background flickering
*/
try {
    document.execCommand("BackgroundImageCache", false, true);
} catch(e) {}

Crafty.extend({
	/**@
	* #Crafty.DOM
	* @category Graphics
	* Collection of utilities for using the DOM.
	*/
	DOM: {
		/**@
		* #Crafty.DOM.window
		* @comp Crafty.DOM
		* Object with `width` and `height` values representing the width
		* and height of the `window`.
		*/
		window: {
			init: function() {
				this.width = window.innerWidth || (window.document.documentElement.clientWidth || window.document.body.clientWidth);
				this.height = window.innerHeight || (window.document.documentElement.clientHeight || window.document.body.clientHeight);
			},
			
			width: 0,
			height: 0
		},
		
		/**@
		* #Crafty.DOM.inner
		* @comp Crafty.DOM
		* @sign public Object Crafty.DOM.inner(HTMLElement obj)
		* @param obj - HTML element to calculate the position
		* @returns Object with `x` key being the `x` position, `y` being the `y` position
		* Find a DOM elements position including
		* padding and border.
		*/
		inner: function(obj) { 
			var rect = obj.getBoundingClientRect(),
				x = rect.left + (window.pageXOffset ? window.pageXOffset : document.body.scrollTop),
				y = rect.top + (window.pageYOffset ? window.pageYOffset : document.body.scrollLeft),
				borderX,
				borderY;
			
			//border left
			borderX = parseInt(this.getStyle(obj, 'border-left-width') || 0, 10);
			borderY = parseInt(this.getStyle(obj, 'border-top-width') || 0, 10);
			if(!borderX || !borderY) { //JS notation for IE
				borderX = parseInt(this.getStyle(obj, 'borderLeftWidth') || 0, 10);
				borderY = parseInt(this.getStyle(obj, 'borderTopWidth') || 0, 10);
			}
			
			x += borderX;
			y += borderY;
			
			return {x: x, y: y}; 
		},
		
		/**@
		* #Crafty.DOM.getStyle
		* @comp Crafty.DOM
		* @sign public Object Crafty.DOM.getStyle(HTMLElement obj, String property)
		* @param obj - HTML element to find the style
		* @param property - Style to return
		* Determine the value of a style on an HTML element. Notation can be
		* in either CSS or JS.
		*/
		getStyle: function(obj,prop) {
			var result;
			if(obj.currentStyle)
				result = obj.currentStyle[this.camelize(prop)];
			else if(window.getComputedStyle)
				result = document.defaultView.getComputedStyle(obj,null).getPropertyValue(this.csselize(prop));
			return result;
		},
		
		/**
		* Used in the Zepto framework
		*
		* Converts CSS notation to JS notation
		*/
		camelize: function(str) { 
			return str.replace(/-+(.)?/g, function(match, chr){ return chr ? chr.toUpperCase() : '' });
		},
		
		/**
		* Converts JS notation to CSS notation
		*/
		csselize: function(str) {
			return str.replace(/[A-Z]/g, function(chr){ return chr ? '-' + chr.toLowerCase() : '' });
		},
		
		/**@
		* #Crafty.DOM.translate
		* @comp Crafty.DOM
		* @sign public Object Crafty.DOM.translate(Number x, Number y)
		* @param x - x position to translate
		* @param y - y position to translate
		* @return Object with x and y as keys and translated values
		*
		* Method will translate x and y positions to positions on the
		* stage. Useful for mouse events with `e.clientX` and `e.clientY`.
		*/
		translate: function(x,y) {
			return {
				x: x - Crafty.stage.x + document.body.scrollLeft + document.documentElement.scrollLeft - Crafty.viewport._x,
				y: y - Crafty.stage.y + document.body.scrollTop + document.documentElement.scrollTop - Crafty.viewport._y
			}
		}
	}
});Crafty.extend({
	/**@
	* #Crafty.randRange
	* @category Misc
	* @sign public Number Crafty.randRange(Number from, Number to)
	* @param from - Lower bound of the range
	* @param to - Upper bound of the range
	* Returns a random number between (and including) the two numbers.
	*/
	randRange: function(from, to) {
		return Math.round(Math.random() * (to - from) + from);
	},
	
	zeroFill: function(number, width) {
		width -= number.toString().length;
		if (width > 0)
			return new Array(width + (/\./.test( number ) ? 2 : 1)).join( '0' ) + number;
		return number.toString();
	},
	
	/**@
	* #Crafty.sprite
	* @category Graphics
	* @sign public this Crafty.sprite([Number tile], String url, Object map[, Number paddingX[, Number paddingY]])
	* @param tile - Tile size of the sprite map, defaults to 1
	* @param url - URL of the sprite image
	* @param map - Object where the key is what becomes a new component and the value points to a position on the sprite map
	* @param paddingX - Horizontal space inbetween tiles. Defaults to 0.
	* @param paddingY - Vertical space inbetween tiles. Defaults to paddingX.
	* Generates components based on positions in a sprite image to be applied to entities.
	*
	* Accepts a tile size, URL and map for the name of the sprite and it's position. 
	*
	* The position must be an array containing the position of the sprite where index `0` 
	* is the `x` position, `1` is the `y` position and optionally `2` is the width and `3` 
	* is the height. If the sprite map has padding, pass the values for the `x` padding 
	* or `y` padding. If they are the same, just add one value.
	*
	* If the sprite image has no consistent tile size, `1` or no argument need be 
	* passed for tile size.
	*
	* Entities that add the generated components are also given a component called `Sprite`.
	* @see Sprite
	*/
	sprite: function(tile, tileh, url, map, paddingX, paddingY) {
		var pos, temp, x, y, w, h, img;
		
		//if no tile value, default to 16
		if(typeof tile === "string") {
			map = url;
			url = tileh;
			tile = 1;
			tileh = 1;
		}
		
		if(typeof tileh == "string") {
			map = url;
			url = tileh;
			tileh = tile;
		}
		
		//if no paddingY, use paddingX
		if(!paddingY && paddingX) paddingY = paddingX;
		paddingX = parseInt(paddingX || 0, 10); //just incase
		paddingY = parseInt(paddingY || 0, 10);
		
		img = Crafty.assets[url];
		if(!img) {
			img = new Image();
			img.src = url;
			Crafty.assets[url] = img;
			img.onload = function() {
				//all components with this img are now ready
				for(var pos in map) {
					Crafty(pos).each(function() {
						this.ready = true;
						this.trigger("Change");
					});
				}
			};
		}
		
		for(pos in map) {
			if(!map.hasOwnProperty(pos)) continue;
			
			temp = map[pos];
			x = temp[0] * (tile + paddingX);
			y = temp[1] * (tileh + paddingY);
			w = temp[2] * tile || tile;
			h = temp[3] * tileh || tileh;
			
			/**@
			* #Sprite
			* @category Graphics
			* Component for using tiles in a sprite map.
			*/
			Crafty.c(pos, {
				ready: false,
				__coord: [x,y,w,h],
				
				init: function() {
					this.requires("Sprite");
					this.__trim = [0,0,0,0];
					this.__image = url;
					this.__coord = [this.__coord[0], this.__coord[1], this.__coord[2], this.__coord[3]];
					this.__tile = tile;
					this.__tileh = tileh;
					this.__padding = [paddingX, paddingY];
					this.img = img;
		
					//draw now
					if(this.img.complete && this.img.width > 0) {
						this.ready = true;
						this.trigger("Change");
					}

					//set the width and height to the sprite size
					this.w = this.__coord[2];
					this.h = this.__coord[3];
				}
			});
		}
		
		return this;
	},
	
	_events: {},

	/**@
	* #Crafty.addEvent
	* @category Events, Misc
	* @sign public this Crafty.addEvent(Object ctx, HTMLElement obj, String event, Function callback)
	* @param ctx - Context of the callback or the value of `this`
	* @param obj - Element to add the DOM event to
	* @param event - Event name to bind to
	* @param callback - Method to execute when triggered
	* Adds DOM level 3 events to elements. The arguments it accepts are the call 
	* context (the value of `this`), the DOM element to attach the event to, 
	* the event name (without `on` (`click` rather than `onclick`)) and 
	* finally the callback method. 
	*
	* If no element is passed, the default element will be `window.document`.
	* 
	* Callbacks are passed with event data.
	* @see Crafty.removeEvent
	*/
	addEvent: function(ctx, obj, type, fn) {
		if(arguments.length === 3) {
			fn = type;
			type = obj;
			obj = window.document;
		}

		//save anonymous function to be able to remove
		var afn = function(e) { var e = e || window.event; fn.call(ctx,e) },
			id = ctx[0] || "";

		if(!this._events[id+obj+type+fn]) this._events[id+obj+type+fn] = afn;
		else return;

		if (obj.attachEvent) { //IE
			obj.attachEvent('on'+type, afn);
		} else { //Everyone else
			obj.addEventListener(type, afn, false);
		}
	},

	/**@
	* #Crafty.removeEvent
	* @category Events, Misc
	* @sign public this Crafty.removeEvent(Object ctx, HTMLElement obj, String event, Function callback)
	* @param ctx - Context of the callback or the value of `this`
	* @param obj - Element the event is on
	* @param event - Name of the event
	* @param callback - Method executed when triggered
	* Removes events attached by `Crafty.addEvent()`. All parameters must 
	* be the same that were used to attach the event including a reference 
	* to the callback method.
	* @see Crafty.addEvent
	*/
	removeEvent: function(ctx, obj, type, fn) {
		if(arguments.length === 3) {
			fn = type;
			type = obj;
			obj = window.document;
		}

		//retrieve anonymouse function
		var id = ctx[0] || "",
			afn = this._events[id+obj+type+fn];

		if(afn) {
			if (obj.detachEvent) {
				obj.detachEvent('on'+type, afn);
			} else obj.removeEventListener(type, afn, false);
			delete this._events[id+obj+type+fn];
		}
	},
	
	/**@
	* #Crafty.background
	* @category Graphics, Stage
	* @sign public void Crafty.background(String value)
	* @param color - Modify the background with a color or image
	* This method is essentially a shortcut for adding a background
	* style to the stage element.
	*/
	background: function(color) {
		Crafty.stage.elem.style.background = color;
	},
	
	/**@
	* #Crafty.viewport
	* @category Stage
	* Viewport is essentially a 2D camera looking at the stage. Can be moved which
	* in turn will react just like a camera moving in that direction.
	*/
	viewport: {
		width: 0, 
		height: 0,
		/**@
		* #Crafty.viewport.x
		* @comp Crafty.viewport
		* Will move the stage and therefore every visible entity along the `x` 
		* axis in the opposite direction.
		*
		* When this value is set, it will shift the entire stage. This means that entity 
		* positions are not exactly where they are on screen. To get the exact position, 
		* simply add `Crafty.viewport.x` onto the entities `x` position.
		*/
		_x: 0,
		/**@
		* #Crafty.viewport.y
		* @comp Crafty.viewport
		* Will move the stage and therefore every visible entity along the `y` 
		* axis in the opposite direction.
		*
		* When this value is set, it will shift the entire stage. This means that entity 
		* positions are not exactly where they are on screen. To get the exact position, 
		* simply add `Crafty.viewport.y` onto the entities `y` position.
		*/
		_y: 0,
		
		scroll: function(axis, v) {
			v = Math.floor(v);
			var change = (v - this[axis]), //change in direction
				context = Crafty.canvas.context,
				style = Crafty.stage.inner.style,
				canvas;
			
			//update viewport and DOM scroll
			this[axis] = v;
			if(axis == '_x') {
				if(context) context.translate(change, 0);
			} else {
				if(context) context.translate(0, change);
			}
			if(context) Crafty.DrawManager.drawAll();
			style[axis == '_x' ? "left" : "top"] = ~~v + "px";
		},
		
		rect: function() {
			return {_x: -this._x, _y: -this._y, _w: this.width, _h: this.height};
		},
		
		init: function(w,h) {
			Crafty.DOM.window.init();
			
			//fullscreen if mobile or not specified
			this.width = (!w || Crafty.mobile) ? Crafty.DOM.window.width : w;
			this.height = (!h || Crafty.mobile) ? Crafty.DOM.window.height : h;
			
			//check if stage exists
			var crstage = document.getElementById("cr-stage");
			
			//create stage div to contain everything
			Crafty.stage = {
				x: 0,
				y: 0,
				fullscreen: false,
				elem: (crstage ? crstage : document.createElement("div")),
				inner: document.createElement("div")
			};
			
			//fullscreen, stop scrollbars
			if((!w && !h) || Crafty.mobile) {
				document.body.style.overflow = "hidden";
				Crafty.stage.fullscreen = true;
			}
			
			Crafty.addEvent(this, window, "resize", function() {
				Crafty.DOM.window.init();
				var w = Crafty.DOM.window.width,
					h = Crafty.DOM.window.height,
					offset;
				
				
				if(Crafty.stage.fullscreen) {
					this.width = w;
					this.height = h;
					Crafty.stage.elem.style.width = w + "px";
					Crafty.stage.elem.style.height = h + "px";
					
					if(Crafty._canvas) {
						Crafty._canvas.width = w + "px";
						Crafty._canvas.height = h + "px";
						Crafty.DrawManager.drawAll();
					}
				}
				
				offset = Crafty.DOM.inner(Crafty.stage.elem);
				Crafty.stage.x = offset.x;
				Crafty.stage.y = offset.y;
			});
			
			Crafty.addEvent(this, window, "blur", function() {
				if(Crafty.settings.get("autoPause")) {
					Crafty.pause();
				}
			});
			Crafty.addEvent(this, window, "focus", function() {
				if(Crafty._paused) {
					Crafty.pause();
				}
			});
			
			//make the stage unselectable
			Crafty.settings.register("stageSelectable", function(v) {
				Crafty.stage.elem.onselectstart = v ? function() { return true; } : function() { return false; };
			});
			Crafty.settings.modify("stageSelectable", false);
			
			//make the stage have no context menu
			Crafty.settings.register("stageContextMenu", function(v) {
				Crafty.stage.elem.oncontextmenu = v ? function() { return true; } : function() { return false; };
			});
			Crafty.settings.modify("stageContextMenu", false);
			
			Crafty.settings.register("autoPause", function(){});
			Crafty.settings.modify("autoPause", false);

			//add to the body and give it an ID if not exists
			if(!crstage) {
				document.body.appendChild(Crafty.stage.elem);
				Crafty.stage.elem.id = "cr-stage";
			}
			
			var elem = Crafty.stage.elem.style,
				offset;
			
			Crafty.stage.elem.appendChild(Crafty.stage.inner);
			Crafty.stage.inner.style.position = "absolute";
			Crafty.stage.inner.style.zIndex = "1";
			
			//css style
			elem.width = this.width + "px";
			elem.height = this.height + "px";
			elem.overflow = "hidden";
			
			if(Crafty.mobile) {
				elem.position = "absolute";
				elem.left = "0px";
				elem.top = "0px";
				
				var meta = document.createElement("meta"),
					head = document.getElementsByTagName("HEAD")[0];
				
				//stop mobile zooming and scrolling
				meta.setAttribute("name", "viewport");
				meta.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no");
				head.appendChild(meta);
				
				//hide the address bar
				meta = document.createElement("meta");
				meta.setAttribute("name", "apple-mobile-web-app-capable");
				meta.setAttribute("content", "yes");
				head.appendChild(meta);
				setTimeout(function() { window.scrollTo(0,1); }, 0);
				
				Crafty.addEvent(this, window, "touchmove", function(e) {
					e.preventDefault();
				});
				
				Crafty.stage.x = 0;
				Crafty.stage.y = 0;
				
			} else {
				elem.position = "relative";
				//find out the offset position of the stage
				offset = Crafty.DOM.inner(Crafty.stage.elem);
				Crafty.stage.x = offset.x;
				Crafty.stage.y = offset.y;
			}
			
			if(Crafty.support.setter) {
				//define getters and setters to scroll the viewport
				this.__defineSetter__('x', function(v) { this.scroll('_x', v); });
				this.__defineSetter__('y', function(v) { this.scroll('_y', v); });
				this.__defineGetter__('x', function() { return this._x; });
				this.__defineGetter__('y', function() { return this._y; });
			//IE9
			} else if(Crafty.support.defineProperty) {
				Object.defineProperty(this, 'x', {set: function(v) { this.scroll('_x', v); }, get: function() { return this._x; }});
				Object.defineProperty(this, 'y', {set: function(v) { this.scroll('_y', v); }, get: function() { return this._y; }});
			} else {
				//create empty entity waiting for enterframe
				this.x = this._x;
				this.y = this._y;
				Crafty.e("viewport"); 
			}
		}
	},
	
	support: {},
	
	/**@
	* #Crafty.keys
	* @category Input
	* Object of key names and the corresponding key code.
	* ~~~
	* BACKSPACE: 8,
    * TAB: 9,
    * ENTER: 13,
    * PAUSE: 19,
    * CAPS: 20,
    * ESC: 27,
    * SPACE: 32,
    * PAGE_UP: 33,
    * PAGE_DOWN: 34,
    * END: 35,
    * HOME: 36,
    * LEFT_ARROW: 37,
    * UP_ARROW: 38,
    * RIGHT_ARROW: 39,
    * DOWN_ARROW: 40,
    * INSERT: 45,
    * DELETE: 46,
    * 0: 48,
    * 1: 49,
    * 2: 50,
    * 3: 51,
    * 4: 52,
    * 5: 53,
    * 6: 54,
    * 7: 55,
    * 8: 56,
    * 9: 57,
    * A: 65,
    * B: 66,
    * C: 67,
    * D: 68,
    * E: 69,
    * F: 70,
    * G: 71,
    * H: 72,
    * I: 73,
    * J: 74,
    * K: 75,
    * L: 76,
    * M: 77,
    * N: 78,
    * O: 79,
    * P: 80,
    * Q: 81,
    * R: 82,
    * S: 83,
    * T: 84,
    * U: 85,
    * V: 86,
    * W: 87,
    * X: 88,
    * Y: 89,
    * Z: 90,
    * NUMPAD_0: 96,
    * NUMPAD_1: 97,
    * NUMPAD_2: 98,
    * NUMPAD_3: 99,
    * NUMPAD_4: 100,
    * NUMPAD_5: 101,
    * NUMPAD_6: 102,
    * NUMPAD_7: 103,
    * NUMPAD_8: 104,
    * NUMPAD_9: 105,
    * MULTIPLY: 106,
    * ADD: 107,
    * SUBSTRACT: 109,
    * DECIMAL: 110,
    * DIVIDE: 111,
    * F1: 112,
    * F2: 113,
    * F3: 114,
    * F4: 115,
    * F5: 116,
    * F6: 117,
    * F7: 118,
    * F8: 119,
    * F9: 120,
    * F10: 121,
    * F11: 122,
    * F12: 123,
    * SHIFT: 16,
    * CTRL: 17,
    * ALT: 18,
    * PLUS: 187,
    * COMMA: 188,
    * MINUS: 189,
    * PERIOD: 190 
	* ~~~
	*/
	keys: {
		'BACKSPACE': 8,
        'TAB': 9,
        'ENTER': 13,
        'PAUSE': 19,
        'CAPS': 20,
        'ESC': 27,
        'SPACE': 32,
        'PAGE_UP': 33,
        'PAGE_DOWN': 34,
        'END': 35,
        'HOME': 36,
        'LEFT_ARROW': 37,
        'UP_ARROW': 38,
        'RIGHT_ARROW': 39,
        'DOWN_ARROW': 40,
        'INSERT': 45,
        'DELETE': 46,
        '0': 48,
        '1': 49,
        '2': 50,
        '3': 51,
        '4': 52,
        '5': 53,
        '6': 54,
        '7': 55,
        '8': 56,
        '9': 57,
        'A': 65,
        'B': 66,
        'C': 67,
        'D': 68,
        'E': 69,
        'F': 70,
        'G': 71,
        'H': 72,
        'I': 73,
        'J': 74,
        'K': 75,
        'L': 76,
        'M': 77,
        'N': 78,
        'O': 79,
        'P': 80,
        'Q': 81,
        'R': 82,
        'S': 83,
        'T': 84,
        'U': 85,
        'V': 86,
        'W': 87,
        'X': 88,
        'Y': 89,
        'Z': 90,
        'NUMPAD_0': 96,
        'NUMPAD_1': 97,
        'NUMPAD_2': 98,
        'NUMPAD_3': 99,
        'NUMPAD_4': 100,
        'NUMPAD_5': 101,
        'NUMPAD_6': 102,
        'NUMPAD_7': 103,
        'NUMPAD_8': 104,
        'NUMPAD_9': 105,
        'MULTIPLY': 106,
        'ADD': 107,
        'SUBSTRACT': 109,
        'DECIMAL': 110,
        'DIVIDE': 111,
        'F1': 112,
        'F2': 113,
        'F3': 114,
        'F4': 115,
        'F5': 116,
        'F6': 117,
        'F7': 118,
        'F8': 119,
        'F9': 120,
        'F10': 121,
        'F11': 122,
        'F12': 123,
        'SHIFT': 16,
        'CTRL': 17,
        'ALT': 18,
        'PLUS': 187,
        'COMMA': 188,
        'MINUS': 189,
        'PERIOD': 190 
	}
});

/**@
* #Crafty.support
* @category Misc, Core
* Determines feature support for what Crafty can do.
*/
(function testSupport() {
	var support = Crafty.support,
		ua = navigator.userAgent.toLowerCase(),
		match = /(webkit)[ \/]([\w.]+)/.exec(ua) || 
				/(o)pera(?:.*version)?[ \/]([\w.]+)/.exec(ua) || 
				/(ms)ie ([\w.]+)/.exec(ua) || 
				/(moz)illa(?:.*? rv:([\w.]+))?/.exec(ua) || [],
		mobile = /iPad|iPod|iPhone|Android|webOS/i.exec(ua);
	
	if(mobile) Crafty.mobile = mobile[0];
	
	/**@
	* #Crafty.support.setter
	* @comp Crafty.support
	* Is `__defineSetter__` supported?
	*/
	support.setter = ('__defineSetter__' in this && '__defineGetter__' in this);
	
	/**@
	* #Crafty.support.defineProperty
	* @comp Crafty.support
	* Is `Object.defineProperty` supported?
	*/
	support.defineProperty = (function() {
		if(!'defineProperty' in Object) return false;
		try { Object.defineProperty({},'x',{}); }
		catch(e) { return false };
		return true;
	})();
	
	/**@
	* #Crafty.support.audio
	* @comp Crafty.support
	* Is HTML5 `Audio` supported?
	*/
	support.audio = ('Audio' in window);
	
	/**@
	* #Crafty.support.prefix
	* @comp Crafty.support
	* Returns the browser specific prefix (`Moz`, `O`, `ms`, `webkit`).
	*/
	support.prefix = (match[1] || match[0]);
	
	//browser specific quirks
	if(support.prefix === "moz") support.prefix = "Moz";
	if(support.prefix === "o") support.prefix = "O";
	
	if(match[2]) {
		/**@
		* #Crafty.support.versionName
		* @comp Crafty.support
		* Version of the browser
		*/
		support.versionName = match[2];
		
		/**@
		* #Crafty.support.version
		* @comp Crafty.support
		* Version number of the browser as an Integer (first number)
		*/
		support.version = +(match[2].split("."))[0];
	}
	
	/**@
	* #Crafty.support.canvas
	* @comp Crafty.support
	* Is the `canvas` element supported?
	*/
	support.canvas = ('getContext' in document.createElement("canvas"));
	
	support.css3dtransform = (typeof document.createElement("div").style[support.prefix + "Perspective"] !== "undefined");
})();

/**
* Entity fixes the lack of setter support
*/
Crafty.c("viewport", {
	init: function() {
		this.bind("EnterFrame", function() {
			if(Crafty.viewport._x !== Crafty.viewport.x) {
				Crafty.viewport.scroll('_x', Crafty.viewport.x);
			}
			
			if(Crafty.viewport._y !== Crafty.viewport.y) {
				Crafty.viewport.scroll('_y', Crafty.viewport.y);
			}
		});
	}
});
/**@
* #Canvas
* @category Graphics
* Draws itself onto a canvas. Crafty.canvas() must be called before hand to initialize
* the canvas element.
*/
Crafty.c("Canvas", {
	
	init: function() {
		if(!Crafty.canvas.context) {
			Crafty.canvas.init();
		}
		
		//increment the amount of canvas objs
		Crafty.DrawManager.total2D++;
		
		this.bind("Change", function(e) {
			//if within screen, add to list	
			if(this._changed === false) {
				this._changed = Crafty.DrawManager.add(e || this, this);
			} else {
				if(e) this._changed = Crafty.DrawManager.add(e, this);
			}
		});
		
		this.bind("Remove", function() {
			Crafty.DrawManager.total2D--;
			Crafty.DrawManager.add(this,this);
		});
	},
	
	/**@
	* #.draw
	* @comp Canvas
	* @sign public this .draw([[Context ctx, ]Number x, Number y, Number w, Number h])
	* @param ctx - Canvas 2D context if drawing on another canvas is required
	* @param x - X offset for drawing a segment
	* @param y - Y offset for drawing a segment
	* @param w - Width of the segement to draw
	* @param h - Height of the segment to draw
	* @triggers Draw
	* Method to draw the entity on the canvas element. Can pass rect values for redrawing a segment of the entity.
	*/
	draw: function(ctx,x,y,w,h) {
		if(!this.ready) return; 
		if(arguments.length === 4) {
			h = w;
			w = y;
			y = x;
			x = ctx;
			ctx = Crafty.canvas.context;
		}
		
		var pos = { //inlined pos() function, for speed
				_x: (this._x + (x || 0)),
				_y: (this._y + (y || 0)),
				_w: (w || this._w),
				_h: (h || this._h)
			},
			context = ctx || Crafty.canvas.context,
			coord = this.__coord || [0,0,0,0],
			co = {
				x: coord[0] + (x || 0),
				y: coord[1] + (y || 0),
				w: w || coord[2],
				h: h || coord[3]
			};
			
		if(this._mbr) {
			context.save();
			
			context.translate(this._origin.x + this._x, this._origin.y + this._y);
			pos._x = -this._origin.x;
			pos._y = -this._origin.y;
			
			context.rotate((this._rotation % 360) * (Math.PI / 180));
		}
		
		//draw with alpha
		if(this._alpha < 1.0) {
			var globalpha = context.globalAlpha;
			context.globalAlpha = this._alpha;
		}
		
		this.trigger("Draw", {type: "canvas", pos: pos, co: co, ctx: context});
		
		if(this._mbr) {
			context.restore();
		}
		if(globalpha) {
			context.globalAlpha = globalpha;
		}
		return this;
	}
});

/**@
* #Crafty.canvas
* @category Graphics
* Collection of methods to draw on canvas.
*/
Crafty.extend({
	canvas: {
		/**@
		* #Crafty.canvas.context
		* @comp Crafty.canvas
		* This will return the 2D context of the main canvas element. 
		* The value returned from `Crafty.canvas.elem.getContext('2d')`.
		*/
		context: null,
		/**@
		* #Crafty.canvas.elem
		* @comp Crafty.canvas
		* Main Canvas element
		*/
		elem: null,
		
		/**@
		* #Crafty.canvas.init
		* @comp Crafty.canvas
		* @sign public void Crafty.canvas.init(void)
		* @triggers NoCanvas
		* Creates a `canvas` element inside the stage element. Must be called
		* before any entities with the Canvas component can be drawn.
		*
		* This method will automatically be called if no `Crafty.canvas.context` is
		* found.
		*/
		init: function() {
			//check if canvas is supported
			if(!Crafty.support.canvas) {
				Crafty.trigger("NoCanvas");
				Crafty.stop();
				return;
			}
			
			//create 3 empty canvas elements
			var c;
			c = document.createElement("canvas");
			c.width = Crafty.viewport.width;
			c.height = Crafty.viewport.height;
			c.style.position = 'absolute';
			c.style.left = "0px";
			c.style.top = "0px";
			
			Crafty.stage.elem.appendChild(c);
			Crafty.canvas.context = c.getContext('2d');
			Crafty.canvas._canvas = c;
		}
	}
});Crafty.extend({
	down: null, //object mousedown, waiting for up
	over: null, //object mouseover, waiting for out
	mouseObjs: 0,
	mousePos: {},
	lastEvent: null,
	keydown: {},
		
	mouseDispatch: function(e) {
		if(!Crafty.mouseObjs) return;
		Crafty.lastEvent = e;
		
		if(e.type === "touchstart") e.type = "mousedown";
		else if(e.type === "touchmove") e.type = "mousemove";
		else if(e.type === "touchend") e.type = "mouseup";
		
		var maxz = -1,
			closest,
			q,
			i = 0, l,
			pos = Crafty.DOM.translate(e.clientX, e.clientY),
			x, y,
			dupes = {},
			tar = e.target?e.target:e.srcElement;
		
		e.realX = x = Crafty.mousePos.x = pos.x;
		e.realY = y = Crafty.mousePos.y = pos.y;
		
		if (tar.nodeName != "CANVAS") {
			// we clicked on a dom element
			while (typeof (tar.id) != 'string' && tar.id.indexOf('ent') == -1) {
				tar = tar.parentNode;
			}
			ent = Crafty(parseInt(tar.id.replace('ent', '')))
			if (ent.has('Mouse') && ent.isAt(x,y))
				closest = ent;
		}
		if(!closest) {
			//search for all mouse entities
			q = Crafty.map.search({_x: x, _y:y, _w:1, _h:1}, false);
			
			for(l=q.length;i<l;++i) {
				//check if has mouse component
				if(!q[i].__c.Mouse) continue;
				
				var current = q[i],
					flag = false;
					
				//weed out duplicates
				if(dupes[current[0]]) continue;
				else dupes[current[0]] = true;
				
				if(current.map) {
					if(current.map.containsPoint(x, y)) {
						flag = true;
					}
				} else if(current.isAt(x, y)) flag = true;
				
				if(flag && (current._z >= maxz || maxz === -1)) {
					//if the Z is the same, select the closest GUID
					if(current._z === maxz && current[0] < closest[0]) {
						continue;
					}
					maxz = current._z;
					closest = current;
				}
			}
		}
		
		//found closest object to mouse
		if(closest) {
			//click must mousedown and out on tile
			if(e.type === "mousedown") {
				this.down = closest;
				this.down.trigger("MouseDown", e);
			} else if(e.type === "mouseup") {
				closest.trigger("MouseUp", e);
				
				//check that down exists and this is down
				if(this.down && closest === this.down) {
					this.down.trigger("Click", e);
				}
				
				//reset down
				this.down = null;
			} else if(e.type === "mousemove") {
				if(this.over !== closest) { //if new mousemove, it is over
					if(this.over) {
						this.over.trigger("MouseOut", e); //if over wasn't null, send mouseout
						this.over = null;
					}
					this.over = closest;
					closest.trigger("MouseOver", e);
				}
			} else closest.trigger(e.type, e); //trigger whatever it is
		} else {
			if(e.type === "mousemove" && this.over) {
				this.over.trigger("MouseOut", e);
				this.over = null;
			}
		}
		
		if (e.type === "mousemove") {
			this.lastEvent = e;
		}
	},
	
	keyboardDispatch: function(e) {
		e.key = e.keyCode || e.which;
		if(e.type === "keydown") {
			if(Crafty.keydown[e.key] !== true) {
				Crafty.keydown[e.key] = true;
				Crafty.trigger("KeyDown", e);
			}
		} else if(e.type === "keyup") {
			delete Crafty.keydown[e.key];
			Crafty.trigger("KeyUp", e);
		}
		
		//prevent searchable keys
		/*
		if((e.metaKey || e.altKey || e.ctrlKey) && !(e.key == 8 || e.key >= 112 && e.key <= 135)) {
			console.log(e);
			if(e.preventDefault) e.preventDefault();
			else e.returnValue = false;
			return false;
		}*/
	}
});

//initialize the input events onload
Crafty.bind("Load", function() {
	Crafty.addEvent(this, "keydown", Crafty.keyboardDispatch);
	Crafty.addEvent(this, "keyup", Crafty.keyboardDispatch);
        
	Crafty.addEvent(this, Crafty.stage.elem, "mousedown", Crafty.mouseDispatch);
	Crafty.addEvent(this, Crafty.stage.elem, "mouseup", Crafty.mouseDispatch);
	Crafty.addEvent(this, Crafty.stage.elem, "mousemove", Crafty.mouseDispatch);
	
	Crafty.addEvent(this, Crafty.stage.elem, "touchstart", Crafty.mouseDispatch);
	Crafty.addEvent(this, Crafty.stage.elem, "touchmove", Crafty.mouseDispatch);
	Crafty.addEvent(this, Crafty.stage.elem, "touchend", Crafty.mouseDispatch);
});

/**@
* #Mouse
* @category Input
* Give entities mouse events such as 
* `mouseover`, `mousedown`, `mouseout`, `mouseup` and `click`.
*/
Crafty.c("Mouse", {
	init: function() {
		Crafty.mouseObjs++;
		this.bind("Remove", function() {
			Crafty.mouseObjs--;
		});
	},
	
	/**@
	* #.areaMap
	* @comp Mouse
	* @sign public this .areaMap(Crafty.Polygon polygon)
	* @param polygon - Instance of Crafty.Polygon used to check if the mouse coordinates are inside this region
	* @sign public this .areaMap(Array point1, .., Array pointN)
	* @param point# - Array with an `x` and `y` position to generate a polygon
	* Assign a polygon to the entity so that mouse events will only be triggered if
	* the coordinates are inside the given polygon.
	* @see Crafty.Polygon
	*/
	areaMap: function(poly) {
		//create polygon
		if(arguments.length > 1) {
			//convert args to array to create polygon
			var args = Array.prototype.slice.call(arguments, 0);
			poly = new Crafty.polygon(args);
		}
		
		poly.shift(this._x, this._y);
		this.map = poly;
		
		this.attach(this.map);
		return this;
	}
});

/**@
* #Draggable
* @category Input
* Give the ability to drag and drop the entity.
*/
Crafty.c("Draggable", {
	_startX: 0,
	_startY: 0,
	_dragging: false,
	
	_ondrag: null,
	_ondown: null,
	_onup: null,
	
	init: function() {
		this.requires("Mouse");
		this._ondrag = function(e) {
			var pos = Crafty.DOM.translate(e.clientX, e.clientY);
			this.x = pos.x - this._startX;
			this.y = pos.y - this._startY;
			
			this.trigger("Dragging", e);
		};
		
		this._ondown = function(e) {
			if(e.button !== 0) return;
			
			//start drag
			this._startX = e.realX - this._x;
			this._startY = e.realY - this._y;
			this._dragging = true;
			
			Crafty.addEvent(this, Crafty.stage.elem, "mousemove", this._ondrag);
			Crafty.addEvent(this, Crafty.stage.elem, "mouseup", this._onup);
			this.trigger("StartDrag", e);
		};
		
		this._onup = function upper(e) {
			Crafty.removeEvent(this, Crafty.stage.elem, "mousemove", this._ondrag);
			Crafty.removeEvent(this, Crafty.stage.elem, "mouseup", this._onup);
			this._dragging = false;
			this.trigger("StopDrag", e);
		};
		
		this.enableDrag();
	},
	
	/**@
	* #.stopDrag
	* @comp Draggable
	* @sign public this .stopDrag(void)
	* Stop the entity from dragging. Essentially reproducing the drop.
	* @see .startDrag
	*/
	stopDrag: function() {
		Crafty.removeEvent(this, Crafty.stage.elem, "mousemove", this._ondrag);
		Crafty.removeEvent(this, Crafty.stage.elem, "mouseup", this._onup);
		
		this._dragging = false;
		this.trigger("StopDrag");
		return this;
	},
	
	/**@
	* #.startDrag
	* @comp Draggable
	* @sign public this .startDrag(void)
	* Make the entity follow the mouse positions.
	* @see .stopDrag
	*/
	startDrag: function() {
		if(!this._dragging) {
			this._dragging = true;
			Crafty.addEvent(this, Crafty.stage.elem, "mousemove", this._ondrag);
		}
	},
	
	/**@
	* #.enableDrag
	* @comp Draggable
	* @sign public this .enableDrag(void)
	* Rebind the mouse events. Use if `.disableDrag` has been called.
	* @see .disableDrag
	*/
	enableDrag: function() {		
		this.bind("MouseDown", this._ondown);
		
		Crafty.addEvent(this, Crafty.stage.elem, "mouseup", this._onup);
		return this;
	},
	
	/**@
	* #.disableDrag
	* @comp Draggable
	* @sign public this .disableDrag(void)
	* Stops entity from being draggable. Reenable with `.enableDrag()`.
	* @see .enableDrag
	*/
	disableDrag: function() {
		this.unbind("MouseDown", this._ondown);
		this.stopDrag();
		return this;
	}
});

/**@
* #Keyboard
* @category Input
* Give entities keyboard events (`keydown` and `keyup`).
*/
Crafty.c("Keyboard", {
	/**@
	* #.isDown
	* @comp Keyboard
	* @sign public Boolean isDown(String keyName)
	* @param keyName - Name of the key to check. See `Crafty.keys`.
	* @sign public Boolean isDown(Number keyCode)
	* @param keyCode - Key code in `Crafty.keys`.
	* Determine if a certain key is currently down.
	*/
	isDown: function(key) {
		if(typeof key === "string") {
			key = Crafty.keys[key];
		}
		return !!Crafty.keydown[key];
	}
});

/**@
* #Multiway
* @category Input
* Used to bind keys to directions and have the entity move accordingly
*/
Crafty.c("Multiway", {	
	_speed: 3,
        
	init: function() {
            this._keyDirection = {};
            this._keys = {};
            this._movement= { x: 0, y: 0};
	},
	
	/**@
	* #.multiway
	* @comp Multiway
	* @sign public this .multiway([Number speed,] Object keyBindings )
	* @param speed - Amount of pixels to move the entity whilst a key is down
	* @param keyBindings - What keys should make the entity go in which direction. Direction is specified in degrees
	* Constructor to initialize the speed and keyBindings. Component will listen for key events and move the entity appropriately. 
	*
	* When direction changes a NewDirection event is triggered with an object detailing the new direction: {x: x_movement, y: y_movement}
	* When entity has moved on either x- or y-axis a Moved event is triggered with an object specifying the old position {x: old_x, y: old_y}
	* @example
	* ~~~
	* this.multiway(3, {UP_ARROW: -90, DOWN_ARROW: 90, RIGHT_ARROW: 0, LEFT_ARROW: 180});
	* this.multiway({W: -90, S: 90, D: 0, A: 180});
	* ~~~
	*/
	multiway: function(speed, keys) {
		if(keys){
			this._speed = speed;
		} else {
			keys = speed;
		}
		
		this._keyDirection = keys;
		this.speed(this._speed);

		this.bind("KeyDown", function(e) {
			if(this._keys[e.key]) {
				this._movement.x = Math.round((this._movement.x + this._keys[e.key].x)*1000)/1000;
				this._movement.y = Math.round((this._movement.y + this._keys[e.key].y)*1000)/1000;
				this.trigger('NewDirection', this._movement);
			}
		})
		.bind("KeyUp", function(e) {
			if(this._keys[e.key]) {
				this._movement.x = Math.round((this._movement.x - this._keys[e.key].x)*1000)/1000;
				this._movement.y = Math.round((this._movement.y - this._keys[e.key].y)*1000)/1000;
				this.trigger('NewDirection', this._movement);
			}
		})
		.bind("EnterFrame",function() {
			if (this.disableControls) return;
	
			if(this._movement.x !== 0) {
				this.x += this._movement.x;
				this.trigger('Moved', {x: this.x - this._movement.x, y: this.y});
			}
			if(this._movement.y !== 0) {
				this.y += this._movement.y;
				this.trigger('Moved', {x: this.x, y: this.y - this._movement.y});
			}
		});

        //Apply movement if key is down when created
        for(var k in keys) {
            if(Crafty.keydown[Crafty.keys[k]]) {
                this.trigger("KeyDown", {key: Crafty.keys[k] });
            }
        }
		
		return this;
	},
        
    speed: function(speed) {
        for(var k in this._keyDirection) {
            var keyCode = Crafty.keys[k] || k;
            this._keys[keyCode] = { 
                x: Math.round(Math.cos(this._keyDirection[k]*(Math.PI/180))*1000 * speed)/1000,
                y: Math.round(Math.sin(this._keyDirection[k]*(Math.PI/180))*1000 * speed)/1000
            };
        }
        return this;
    }
});

/**@
* #Fourway
* @category Input
* Move an entity in four directions by using the
* arrow keys or `W`, `A`, `S`, `D`.
*/
Crafty.c("Fourway", {	
	
	init: function() {
		this.requires("Multiway");
	},
	
	/**@
	* #.fourway
	* @comp Fourway
	* @sign public this .fourway(Number speed)
	* @param speed - Amount of pixels to move the entity whilst a key is down
	* Constructor to initialize the speed. Component will listen for key events and move the entity appropriately. 
	* This includes `Up Arrow`, `Right Arrow`, `Down Arrow`, `Left Arrow` as well as `W`, `A`, `S`, `D`.
	*
	* The key presses will move the entity in that direction by the speed passed in the argument.
	*/
	fourway: function(speed) {
		this.multiway(speed, { 
            UP_ARROW: -90, 
            DOWN_ARROW: 90, 
            RIGHT_ARROW: 0, 
            LEFT_ARROW: 180,
            W: -90, 
            S: 90, 
            D: 0, 
            A: 180
        });
                
		return this;
	}
});

/**@
* #Twoway
* @category Input
* Move an entity in two directions: left or right as well as
* jump.
*/
Crafty.c("Twoway", {
	_speed: 3,
	_up: false,
	
	init: function() {
		this.requires("Keyboard");
	},
	
	/**@
	* #.twoway
	* @comp Twoway
	* @sign public this .twoway(Number speed[, Number jumpSpeed])
	* @param speed - Amount of pixels to move left or right
	* @param jumpSpeed - How high the entity should jump
	* Constructor to initialize the speed and power of jump. Component will 
	* listen for key events and move the entity appropriately. This includes 
	* `Up Arrow`, `Right Arrow`, `Left Arrow` as well as W, A, D. Used with the 
	* `gravity` component to simulate jumping.
	*
	* The key presses will move the entity in that direction by the speed passed in 
	* the argument. Pressing the `Up Arrow` or `W` will cause the entiy to jump.
	* @see Gravity, Fourway
	*/
	twoway: function(speed,jump) {
		if(speed) this._speed = speed;
		jump = jump || this._speed * 2;
		
		this.bind("EnterFrame", function() {
			if (this.disableControls) return;
			if(this.isDown("RIGHT_ARROW") || this.isDown("D")) {
				this.x += this._speed;
			}
			if(this.isDown("LEFT_ARROW") || this.isDown("A")) {
				this.x -= this._speed;
			}
			if(this._up) {
				this.y -= jump;
				this._falling = true;
			}
		}).bind("KeyDown", function() {
			if(this.isDown("UP_ARROW") || this.isDown("W")) this._up = true;
		});
		
		return this;
	}
});
/**@
* #SpriteAnimation
* @category Animation
* Used to animate sprites by changing the sprites in the sprite map.
*/
Crafty.c("SpriteAnimation", {
	_reels: null,
	_frame: null,
	_current: null,
	
	init: function() {
		this._reels = {};
	},

	/**@
	* #.animate
	* @comp SpriteAnimation
	* @sign public this .animate(String id, Number fromX, Number y, Number toX)
	* @param id - ID of the animation reel being created
	* @param fromX - Starting `x` position on the sprite map
	* @param y - `y` position on the sprite map. Will remain constant through the animation.
	* @param toX - End `x` position on the sprite map
	* @sign public this .animate(String id, Array frames)
	* @param frames - Array of containing an array with the `x` and `y` values
	* @sign public this .animate(String id, Number duration[, Number repeatCount])
	* @param duration - Play the animation with a duration (in frames)
	* Method to setup animation reels or play pre-made reels. Animation works by changing the sprites over 
	* a duration. Only works for sprites built with the Crafty.sprite methods. See the Tween component for animation of 2D properties.
	*
	* To setup an animation reel, pass the name of the reel (used to identify the reel and play it later), and either an 
	* array of absolute sprite positions or the start x on the sprite map, the y on the sprite map and then the end x on the sprite map.
	*
	* To play a reel, pass the name of the reel and the duration it should play for (in frames). If you need
	* to repeat the animation, simply pass in the amount of times the animation should repeat. To repeat
	* forever, pass in `-1`.
	*
	* @triggers AnimationEnd - When the animation finishes
	*/
	animate: function(id, fromx, y, tox) {
		var reel, i, tile, tileh, duration, pos;
        
        //play a reel
		if(arguments.length < 4 && typeof fromx === "number") {
			//make sure not currently animating
			this._current = id;
			
			reel = this._reels[id];
			duration = fromx;
            
			this._frame = {
				reel: reel, //reel to play
				frameTime: Math.ceil(duration / reel.length), //number of frames inbetween slides
				frame: 0, //current slide/frame
				current: 0,
				repeat: 0
			};
			if (arguments.length === 3 && typeof y === "number") {
				//User provided repetition count
				if (y === -1) this._frame.repeatInfinitly = true;
				else this._frame.repeat = y;
			}
			
			pos = this._frame.reel[0];
			this.__coord[0] = pos[0];
			this.__coord[1] = pos[1];

			this.bind("EnterFrame", this.drawFrame);
			return this;
		}
		if(typeof fromx === "number") {
			i = fromx;
			reel = [];
			tile = this.__tile;
			tileh = this.__tileh;
				
			if (tox > fromx) {
				for(;i<=tox;i++) {
					reel.push([i * tile, y * tileh]);
				}
			} else {
				for(;i>=tox;i--) {
					reel.push([i * tile, y * tileh]);
				}
			}
			
			this._reels[id] = reel;
		} else if(typeof fromx === "object") {
			i=0;
			reel = [];
			tox = fromx.length-1;
			tile = this.__tile;
			tileh = this.__tileh;
			
			for(;i<=tox;i++) {
				pos = fromx[i];
				reel.push([pos[0] * tile, pos[1] * tileh]);
			}
			
			this._reels[id] = reel;
		}
		
		return this;
	},
	
	drawFrame: function(e) {
		var data = this._frame;
		
		if(this._frame.current++ === data.frameTime) {
			var pos = data.reel[data.frame++];
			
			this.__coord[0] = pos[0];
			this.__coord[1] = pos[1];
			this._frame.current = 0;
		}
		
		
		if(data.frame === data.reel.length && this._frame.current === data.frameTime) {
			data.frame = 0;
			if (this._frame.repeatInfinitly === true || this._frame.repeat > 0) {
				if (this._frame.repeat) this._frame.repeat--;
				this._frame.current = 0;
				this._frame.frame = 0;
			} else {
				this.trigger("AnimationEnd", {reel: data.reel});
				this.stop();
				return;
			}
		}
		
		this.trigger("Change");
	},
	
	/**@
	* #.stop
	* @comp SpriteAnimation
	* @sign public this .stop(void)
	* @triggers AnimationEnd - Animation is ended
	* Stop any animation currently playing.
	*/
	stop: function() {
		this.unbind("EnterFrame", this.drawFrame);
		this.unbind("AnimationEnd");
		this._current = null;
		this._frame = null;
		
		return this;
	},
	
	/**@
	* #.reset
	* @comp SpriteAnimation
	* @sign public this .reset(void)
	* Method will reset the entities sprite to its original.
	*/
	reset: function() {
		if(!this._frame) return this;
		
		var co = this._frame.reel[0];
		this.__coord[0] = co[0];
		this.__coord[1] = co[1];
		this.stop();
		
		return this;
	},
	
	/**@
	* #.isPlaying
	* @comp SpriteAnimation
	* @sign public Boolean .isPlaying([String reel])
	* @reel reel - Determine if this reel is playing
	* Determines if an animation is currently playing. If a reel is passed, it will determine
	* if the passed reel is playing.
	*/
	isPlaying: function(id) {
		if(!id) return !!this._interval;
		return this._current === id; 
	}
});

/**@
* #Tween
* @category Animation
* Component to animate the change in 2D properties over time.
*/
Crafty.c("Tween", {
	/**@
	* #.tween
	* @comp Tween
	* @sign public this .tween(Object properties, Number duration)
	* @param properties - Object of 2D properties and what they should animate to
	* @param duration - Duration to animate the properties over (in frames)
	* This method will animate a 2D entities properties over the specified duration.
	* These include `x`, `y`, `w`, `h`, `alpha` and `rotation`.
	*
	* The object passed should have the properties as keys and the value should be the resulting
	* values of the properties.
	* @example
	* Move an object to 100,100 and fade out in 200 frames.
	* ~~~
	* Crafty.e("2D")
	*    .attr({alpha: 1.0, x: 0, y: 0})
	*    .tween({alpha: 0.0, x: 100, y: 100}, 200)
	* ~~~
	*/
	tween: function(props, duration) {
        this.each(function() {
            var prop,
            old = {},
            step = {},
            startFrame = Crafty.frame(),
            endFrame = startFrame + duration;
            
            //store the old properties
            for(prop in props) {
                old[prop] = this['_'+prop];
                step[prop] = (props[prop] - old[prop]) / duration;
            }

			console.log("start tween");
            
            this.bind("EnterFrame", function d(e) {
				if (this.has('Mouse')) {
					var over = Crafty.over,
						mouse = Crafty.mousePos;
					if (over && over[0] == this[0] && !this.isAt(mouse.x, mouse.y)) {
						this.trigger('MouseOut', Crafty.lastEvent);
						Crafty.over = null;
					}
					else if ((!over || over[0] != this[0]) && this.isAt(mouse.x, mouse.y)) {
						Crafty.over = this;
						this.trigger('MouseOver', Crafty.lastEvent);
					}
				}
                if(e.frame >= endFrame) {
					console.log("end tween");
                    this.unbind("EnterFrame", d);
					this.trigger("TweenEnd");
                    return;
                }
                for(var prop in props) {
                    this[prop] += step[prop];
                }
            });
        });
        return this;
	}
});

/**@
* #Color
* @category Graphics
* Draw a solid color for the entity
*/
Crafty.c("Color", {
	_color: "",
	ready: true,
	
	init: function() {
		this.bind("Draw", function(e) {
			if(e.type === "DOM") {
				e.style.background = this._color;
				e.style.lineHeight = 0;
			} else if(e.type === "canvas") {
				if(this._color) e.ctx.fillStyle = this._color;
				e.ctx.fillRect(e.pos._x,e.pos._y,e.pos._w,e.pos._h);
			}
		});
	},
	
	/**@
	* #.color
	* @comp Color
	* @sign public this .color(String color)
	* @param color - Color of the rectangle
	* Will create a rectangle of solid color for the entity.
	*
	* The argument must be a color readable depending on how it's drawn. Canvas requires 
	* using `rgb(0 - 255, 0 - 255, 0 - 255)` or `rgba()` whereas DOM can be hex or any other desired format.
	*/
	color: function(color) {
		this._color = color;
		this.trigger("Change");
		return this;
	}
});

/**@
* #Tint
* @category Graphics
* Similar to Color by adding an overlay of semi-transparent color.
*
* *Note: Currently one works for Canvas*
*/
Crafty.c("Tint", {
	_color: null,
	_strength: 1.0,
	
	init: function() {
        var draw = function d(e) {
    		var context = e.ctx || Crafty.canvas.context;
			
			context.fillStyle = this._color || "rgb(0,0,0)";
			context.fillRect(e.pos._x, e.pos._y, e.pos._w, e.pos._h);
		};
        
		this.bind("Draw", draw).bind("RemoveComponent", function(id) {
            if(id === "Tint") this.unbind("Draw", draw);  
        });
	},
	
	/**@
	* #.tint
	* @comp Tint
	* @sign public this .tint(String color, Number strength)
	* @param color - The color in hexidecimal
	* @param strength - Level of opacity
	* Modify the color and level opacity to give a tint on the entity.
	*/
	tint: function(color, strength) {
		this._strength = strength;
		this._color = Crafty.toRGB(color, this._strength);
		
		this.trigger("Change");
		return this;
	}
});

/**@
* #Image
* @category Graphics
* Draw an image with or without repeating (tiling).
*/
Crafty.c("Image", {
	_repeat: "repeat",
	ready: false,
	
	init: function() {
        var draw = function(e) {
    		if(e.type === "canvas") {
				//skip if no image
				if(!this.ready || !this._pattern) return;
				
				var context = e.ctx;
				
				context.fillStyle = this._pattern;
				
				//context.save();
				//context.translate(e.pos._x, e.pos._y);
				context.fillRect(this._x,this._y,this._w, this._h);
				//context.restore();
			} else if(e.type === "DOM") {
				if(this.__image) 
					e.style.background = "url(" + this.__image + ") "+this._repeat;
			}
		};
        
		this.bind("Draw", draw).bind("RemoveComponent", function(id) {
            if(id === "Image") this.unbind("Draw", draw);  
        });
	},
	
	/**@
	* #image
	* @comp Image
	* @sign public this .image(String url[, String repeat])
	* @param url - URL of the image
	* @param repeat - If the image should be repeated to fill the entity.
	* Draw specified image. Repeat follows CSS syntax (`"no-repeat", "repeat", "repeat-x", "repeat-y"`);
	*
	* *Note: Default repeat is `no-repeat` which is different to standard DOM (which is `repeat`)*
	*
	* If the width and height are `0` and repeat is set to `no-repeat` the width and 
	* height will automatically assume that of the image. This is an 
	* easy way to create an image without needing sprites.
	* @example
	* Will default to no-repeat. Entity width and height will be set to the images width and height
	* ~~~
	* var ent = Crafty.e("2D, DOM, image").image("myimage.png");
	* ~~~
	* Create a repeating background.
	* ~~~
    * var bg = Crafty.e("2D, DOM, image")
	*              .attr({w: Crafty.viewport.width, h: Crafty.viewport.height})
	*              .image("bg.png", "repeat");
	* ~~~
	* @see Crafty.sprite
	*/
	image: function(url, repeat) {
		this.__image = url;
		this._repeat = repeat || "no-repeat";
		
		
		this.img = Crafty.assets[url];
		if(!this.img) {
			this.img = new Image();
			Crafty.assets[url] = this.img;
			this.img.src = url;
			var self = this;
			
			this.img.onload = function() {
				if(self.has("Canvas")) self._pattern = Crafty.canvas.context.createPattern(self.img, self._repeat);
				self.ready = true;
				
				if(self._repeat === "no-repeat") {
					self.w = self.img.width;
					self.h = self.img.height;
				}
				
				self.trigger("Change");
			};
			
			return this;
		} else {
			this.ready = true;
			if(this.has("Canvas")) this._pattern = Crafty.canvas.context.createPattern(this.img, this._repeat);
			if(this._repeat === "no-repeat") {
				this.w = this.img.width;
				this.h = this.img.height;
			}
		}
		
		
		this.trigger("Change");
		
		return this;
	}
});

Crafty.extend({
	_scenes: [],
	_current: null,
	
	/**@
	* #Crafty.scene
	* @category Scenes, Stage
	* @sign public void Crafty.scene(String sceneName, Function init)
	* @param sceneName - Name of the scene to add
	* @param init - Function execute when scene is played
	* @sign public void Crafty.scene(String sceneName)
	* @param sceneName - Name of scene to play
	* Method to create scenes on the stage. Pass an ID and function to register a scene. 
	*
	* To play a scene, just pass the ID. When a scene is played, all 
	* entities with the `2D` component on the stage are destroyed.
	*
	* If you want some entities to persist over scenes (as in not be destroyed) 
	* simply add the component `persist`.
	*/
	scene: function(name, fn) {
		//play scene
		if(arguments.length === 1) {
			Crafty("2D").each(function() {
				if(!this.has("persist")) this.destroy();
			}); //clear screen of all 2D objects except persist
			this._scenes[name].call(this);
			this._current = name;
			return;
		}
		//add scene
		this._scenes[name] = fn;
		return;
	},
	
	rgbLookup:{},
	
	toRGB: function(hex,alpha) {
		var lookup = this.rgbLookup[hex];
		if(lookup) return lookup;
		
		var hex = (hex.charAt(0) === '#') ? hex.substr(1) : hex,
			c = [], result;
			
		c[0] = parseInt(hex.substr(0, 2), 16);
		c[1] = parseInt(hex.substr(2, 2), 16);
		c[2] = parseInt(hex.substr(4, 2), 16);
			
		result = alpha === undefined ? 'rgb('+c.join(',')+')' : 'rgba('+c.join(',')+','+alpha+')';
		lookup = result;
		
		return result;
	}
});

/**
* Draw Manager will manage objects to be drawn and implement
* the best method of drawing in both DOM and canvas
*/
Crafty.DrawManager = (function() {
	/** array of dirty rects on screen */
	var register = [],
	/** array of DOMs needed updating */
		dom = [];
	
	return {
		/** Quick count of 2D objects */
		total2D: Crafty("2D").length,
		
		onScreen: function(rect) {
			return Crafty.viewport._x + rect._x + rect._w > 0 && Crafty.viewport._y + rect._y + rect._h > 0 &&
				   Crafty.viewport._x + rect._x < Crafty.viewport.width && Crafty.viewport._y + rect._y < Crafty.viewport.height;
		},
		
		merge: function(set) {
			do {
				var newset = [], didMerge = false, i = 0,
					l = set.length, current, next, merger;
				
				while(i < l) {
					current = set[i];
					next = set[i+1];
					
					if(i < l - 1 && current._x < next._x + next._w && current._x + current._w > next._x &&
									current._y < next._y + next._h && current._h + current._y > next._y) {	
						
						merger = {
							_x: ~~Math.min(current._x, next._x),
							_y: ~~Math.min(current._y, next._y),
							_w: Math.max(current._x, next._x) + Math.max(current._w, next._w),
							_h: Math.max(current._y, next._y) + Math.max(current._h, next._h)
						};
						merger._w = merger._w - merger._x;
						merger._h = merger._h - merger._y;
						merger._w = (merger._w == ~~merger._w) ? merger._w : merger._w + 1 | 0;
						merger._h = (merger._h == ~~merger._h) ? merger._h : merger._h + 1 | 0;
						
						newset.push(merger);
					
						i++;
						didMerge = true;
					} else newset.push(current);
					i++;
				}

				set = newset.length ? Crafty.clone(newset) : set;
				
				if(didMerge) i = 0;
			} while(didMerge);
			
			return set;
		},
		
		/**
		* Calculate the bounding rect of dirty data
		* and add to the register
		*/
		add: function add(old,current) {
			if(!current) {
				dom.push(old);
				return;
			}
			
			var rect,
				before = old._mbr || old,
				after = current._mbr || current;
				
			if(old === current) {
				rect = old.mbr() || old.pos();
			} else {
				rect =  {
					_x: ~~Math.min(before._x, after._x),
					_y: ~~Math.min(before._y, after._y),
					_w: Math.max(before._w, after._w) + Math.max(before._x, after._x),
					_h: Math.max(before._h, after._h) + Math.max(before._y, after._y)
				};
				
				rect._w = (rect._w - rect._x);
				rect._h = (rect._h - rect._y);
			}
			
			if(rect._w === 0 || rect._h === 0 || !this.onScreen(rect)) {
				return false;
			}
			
			//floor/ceil
			rect._x = ~~rect._x;
			rect._y = ~~rect._y;
			rect._w = (rect._w === ~~rect._w) ? rect._w : rect._w + 1 | 0;
			rect._h = (rect._h === ~~rect._h) ? rect._h : rect._h + 1 | 0;
			
			//add to register, check for merging
			register.push(rect);
			
			//if it got merged
			return true;
		},
		
		debug: function() {
			console.log(register, dom);
		},
		
		drawAll: function(rect) {
			var rect = rect || Crafty.viewport.rect(), q,
				i = 0, l, ctx = Crafty.canvas.context,
				current;
			
			q = Crafty.map.search(rect);
			l = q.length;
			
			ctx.clearRect(rect._x, rect._y, rect._w, rect._h);
			
			q.sort(function(a,b) { return a._global - b._global; });
			for(;i<l;i++) {
				current = q[i];
				if(current._visible && current.__c.Canvas) {
					current.draw();
					current._changed = false;
				}
			}
		},

		/**
		* Calculate the common bounding rect of multiple canvas entities
		* Returns coords
		*/
		boundingRect: function(set) {
			if (!set || !set.length) return;
			var newset = [], i = 1,
			l = set.length, current, master=set[0], tmp;
			master=[master._x, master._y, master._x + master._w, master._y + master._h];
			while(i < l) {
				current = set[i];
				tmp = [current._x, current._y, current._x + current._w, current._y + current._h];
				if (tmp[0]<master[0]) master[0] = tmp[0];
				if (tmp[1]<master[1]) master[1] = tmp[1];
				if (tmp[2]>master[2]) master[2] = tmp[2];
				if (tmp[3]>master[3]) master[3] = tmp[3];
				i++;
			}
			tmp=master;
			master={_x:tmp[0],_y:tmp[1],_w:tmp[2]-tmp[0],_h:tmp[3]-tmp[1]};

			return master;
		},

		/**
		* Redraw all the dirty regions
		*/
		draw: function draw() {
			//if nothing in register, stop
			if(!register.length && !dom.length) return;
			
			var i = 0, l = register.length, k = dom.length, rect, q,
				j, len, dupes, obj, ent, objs = [], ctx = Crafty.canvas.context;
				
			//loop over all DOM elements needing updating
			for(;i<k;++i) {
				dom[i].draw()._changed = false;
			}
			//reset counter and DOM array
			dom.length = i = 0;
			
			//again, stop if nothing in register
			if(!l) { return; }
			
			//if the amount of rects is over 60% of the total objects
			//do the naive method redrawing
			if(l / this.total2D > 0.6) {
				this.drawAll();
				register.length = 0;
				return;
			}
			
			register = this.merge(register);
			for(;i<l;++i) { //loop over every dirty rect
				rect = register[i];
				if(!rect) continue;
				q = Crafty.map.search(rect, false); //search for ents under dirty rect
				
				dupes = {};
				
				//loop over found objects removing dupes and adding to obj array
				for(j = 0, len = q.length; j < len; ++j) {
					obj = q[j];
					
					if(dupes[obj[0]] || !obj._visible || !obj.__c.Canvas)
						continue;
					dupes[obj[0]] = true;
					
					objs.push({obj: obj, rect: rect});
				}
				
				//clear the rect from the main canvas
				ctx.clearRect(rect._x, rect._y, rect._w, rect._h);
				
			}
			
			//sort the objects by the global Z
			objs.sort(function(a,b) { return a.obj._global - b.obj._global; });
			if(!objs.length){  return; }
			
			//loop over the objects
			for(i = 0, l = objs.length; i < l; ++i) {
				obj = objs[i];
				rect = obj.rect;
				ent = obj.obj;
				
				var area = ent._mbr || ent, 
					x = (rect._x - area._x <= 0) ? 0 : ~~(rect._x - area._x),
					y = (rect._y - area._y < 0) ? 0 : ~~(rect._y - area._y),
					w = ~~Math.min(area._w - x, rect._w - (area._x - rect._x), rect._w, area._w),
					h = ~~Math.min(area._h - y, rect._h - (area._y - rect._y), rect._h, area._h);
				
				//no point drawing with no width or height
				if(h === 0 || w === 0) continue;
				
				ctx.save();
				ctx.beginPath();
				ctx.moveTo(rect._x, rect._y);
				ctx.lineTo(rect._x + rect._w, rect._y);
				ctx.lineTo(rect._x + rect._w, rect._h + rect._y);
				ctx.lineTo(rect._x, rect._h + rect._y);
				ctx.lineTo(rect._x, rect._y);
				
				ctx.clip();
				
				ent.draw();
				ctx.closePath();
				ctx.restore();

				//allow entity to re-register
				ent._changed = false;
			}
			
			//empty register
			register.length = 0;
			//all merged IDs are now invalid
			merged = {};
		}
	};
})();Crafty.extend({
	/**@
	* #Crafty.isometric
	* @category 2D
	* Place entities in a 45deg isometric fashion.
	*/
	isometric: {
		_tile: 0,
		_z: 0,
		
		/**@
		* #Crafty.isometric.size
		* @comp Crafty.isometric
		* @sign public this Crafty.isometric.size(Number tileSize)
		* @param tileSize - The size of the tiles to place.
		* Method used to initialize the size of the isometric placement.
		* Recommended to use a size alues in the power of `2` (128, 64 or 32). 
		* This makes it easy to calculate positions and implement zooming.
		* @see Crafty.isometric.place
		*/
		size: function(tile) {
			this._tile = tile;
			return this;
		},
		
		/**@
		* #Crafty.isometric.place
		* @comp Crafty.isometric
		* @sign public this Crafty.isometric.size(Number x, Number y, Number z, Entity tile)
		* @param x - The `x` position to place the tile
		* @param y - The `y` position to place the tile
		* @param z - The `z` position or height to place the tile
		* @param tile - The entity that should be position in the isometric fashion
		* Use this method to place an entity in an isometric grid.
		* @see Crafty.isometric.size
		*/
		place: function(x,y,z, obj) {
			var m = x * this._tile + (y & 1) * (this._tile / 2),
				n = y * this._tile / 4,
				n = n - z * (this._tile / 2);
				
			obj.attr({x: m  + Crafty.viewport._x, y: n  + Crafty.viewport._y}).z += z;
			return this;
		}
	}
});//Particle component
//Based on Parcycle by Mr. Speaker, licensed under the MIT,
//Ported by Leo Koppelkamm
//**This is canvas only & won't do anything if the browser doesn't support it!**

Crafty.c("particles", {
	init: function () {
		//We need to clone it
		this._Particles = Crafty.clone(this._Particles);
	},
	particles: function (options) {

		if (!Crafty.support.canvas || Crafty.deactivateParticles) return this;

		//If we drew on the main canvas, we'd have to redraw 
		//potentially huge sections of the screen every frame
		//So we create a separate canvas, where we only have to redraw 
		//the changed particles.
		var c, ctx, relativeX, relativeY, bounding;

		c = document.createElement("canvas");
		c.width = Crafty.viewport.width;
		c.height = Crafty.viewport.height;
		c.style.position = 'absolute';

		Crafty.stage.elem.appendChild(c);

		ctx = c.getContext('2d');

		this._Particles.init(options);

		relativeX = this.x + Crafty.viewport.x;
		relativeY = this.y + Crafty.viewport.y;
		this._Particles.position = this._Particles.vectorHelpers.create(relativeX, relativeY);

		var oldViewport = {x: Crafty.viewport.x, y:Crafty.viewport.y};
		
		this.bind('EnterFrame', function () {
			relativeX = this.x + Crafty.viewport.x;
			relativeY = this.y + Crafty.viewport.y;
			this._Particles.viewportDelta = {x: Crafty.viewport.x - oldViewport.x, y: Crafty.viewport.y - oldViewport.y};

			oldViewport = {x: Crafty.viewport.x, y:Crafty.viewport.y};
				
			this._Particles.position = this._Particles.vectorHelpers.create(relativeX, relativeY);

			//Selective clearing
			if (typeof Crafty.DrawManager.boundingRect == 'function') {
				bounding = Crafty.DrawManager.boundingRect(this._Particles.register);
				if (bounding) ctx.clearRect(bounding._x, bounding._y, bounding._w, bounding._h);
			} else {
				ctx.clearRect(0, 0, Crafty.viewport.width, Crafty.viewport.height);
			}

			//This updates all particle colors & positions
			this._Particles.update();

			//This renders the updated particles
			this._Particles.render(ctx);
		});
		return this;
	},
	_Particles: {
		presets: {
			maxParticles: 150,
			size: 18,
			sizeRandom: 4,
			speed: 1,
			speedRandom: 1.2,
			// Lifespan in frames
			lifeSpan: 29,
			lifeSpanRandom: 7,
			// Angle is calculated clockwise: 12pm is 0deg, 3pm is 90deg etc.
			angle: 65,
			angleRandom: 34,
			startColour: [255, 131, 0, 1],
			startColourRandom: [48, 50, 45, 0],
			endColour: [245, 35, 0, 0],
			endColourRandom: [60, 60, 60, 0],
			// Only applies when fastMode is off, specifies how sharp the gradients are drawn
			sharpness: 20,
			sharpnessRandom: 10,
			// Random spread from origin
			spread: 10,
			// How many frames should this last
			duration: -1,
			// Will draw squares instead of circle gradients
			fastMode: false,
			gravity:{x: 0, y: 0.1},
			// sensible values are 0-3
			jitter: 0,
			
			//Don't modify the following
			particles: [],
			active: true,
			particleCount: 0,
			elapsedFrames: 0,
			emissionRate: 0,
			emitCounter: 0,
			particleIndex: 0
		},


		init: function (options) {
			this.position = this.vectorHelpers.create(0, 0);
			if (typeof options == 'undefined') var options = {};

			//Create current config by mergin given options and presets.
			for (key in this.presets) {
				if (typeof options[key] != 'undefined') this[key] = options[key];
				else this[key] = this.presets[key];
			}

			this.emissionRate = this.maxParticles / this.lifeSpan;
			this.positionRandom = this.vectorHelpers.create(this.spread, this.spread);
		},

		addParticle: function () {
			if (this.particleCount == this.maxParticles) {
				return false;
			}

			// Take the next particle out of the particle pool we have created and initialize it	
			var particle = new this.particle(this.vectorHelpers);
			this.initParticle(particle);
			this.particles[this.particleCount] = particle;
			// Increment the particle count
			this.particleCount++;

			return true;
		},
		RANDM1TO1: function() {
			return Math.random() * 2 - 1;
		},		
		initParticle: function (particle) {
			particle.position.x = this.position.x + this.positionRandom.x * this.RANDM1TO1();
			particle.position.y = this.position.y + this.positionRandom.y * this.RANDM1TO1();

			var newAngle = (this.angle + this.angleRandom * this.RANDM1TO1()) * (Math.PI / 180); // convert to radians
			var vector = this.vectorHelpers.create(Math.sin(newAngle), -Math.cos(newAngle)); // Could move to lookup for speed
			var vectorSpeed = this.speed + this.speedRandom * this.RANDM1TO1();
			particle.direction = this.vectorHelpers.multiply(vector, vectorSpeed);

			particle.size = this.size + this.sizeRandom * this.RANDM1TO1();
			particle.size = particle.size < 0 ? 0 : ~~particle.size;
			particle.timeToLive = this.lifeSpan + this.lifeSpanRandom * this.RANDM1TO1();

			particle.sharpness = this.sharpness + this.sharpnessRandom * this.RANDM1TO1();
			particle.sharpness = particle.sharpness > 100 ? 100 : particle.sharpness < 0 ? 0 : particle.sharpness;
			// internal circle gradient size - affects the sharpness of the radial gradient
			particle.sizeSmall = ~~ ((particle.size / 200) * particle.sharpness); //(size/2/100)
			var start = [
				this.startColour[0] + this.startColourRandom[0] * this.RANDM1TO1(),
				this.startColour[1] + this.startColourRandom[1] * this.RANDM1TO1(),
				this.startColour[2] + this.startColourRandom[2] * this.RANDM1TO1(),
				this.startColour[3] + this.startColourRandom[3] * this.RANDM1TO1()
				];

			var end = [
				this.endColour[0] + this.endColourRandom[0] * this.RANDM1TO1(),
				this.endColour[1] + this.endColourRandom[1] * this.RANDM1TO1(),
				this.endColour[2] + this.endColourRandom[2] * this.RANDM1TO1(),
				this.endColour[3] + this.endColourRandom[3] * this.RANDM1TO1()
				];

			particle.colour = start;
			particle.deltaColour[0] = (end[0] - start[0]) / particle.timeToLive;
			particle.deltaColour[1] = (end[1] - start[1]) / particle.timeToLive;
			particle.deltaColour[2] = (end[2] - start[2]) / particle.timeToLive;
			particle.deltaColour[3] = (end[3] - start[3]) / particle.timeToLive;
		},
		update: function () {
			if (this.active && this.emissionRate > 0) {
				var rate = 1 / this.emissionRate;
				this.emitCounter++;
				while (this.particleCount < this.maxParticles && this.emitCounter > rate) {
					this.addParticle();
					this.emitCounter -= rate;
				}
				this.elapsedFrames++;
				if (this.duration != -1 && this.duration < this.elapsedFrames) {
					this.stop();
				}
			}

			this.particleIndex = 0;
			this.register = [];
			var draw;
			while (this.particleIndex < this.particleCount) {

				var currentParticle = this.particles[this.particleIndex];

				// If the current particle is alive then update it
				if (currentParticle.timeToLive > 0) {

					// Calculate the new direction based on gravity
					currentParticle.direction = this.vectorHelpers.add(currentParticle.direction, this.gravity);
					currentParticle.position = this.vectorHelpers.add(currentParticle.position, currentParticle.direction);
					currentParticle.position = this.vectorHelpers.add(currentParticle.position, this.viewportDelta);
					if (this.jitter) {
						currentParticle.position.x += this.jitter * this.RANDM1TO1(); 
						currentParticle.position.y += this.jitter * this.RANDM1TO1();
					}
					currentParticle.timeToLive--;

					// Update colours
					var r = currentParticle.colour[0] += currentParticle.deltaColour[0];
					var g = currentParticle.colour[1] += currentParticle.deltaColour[1];
					var b = currentParticle.colour[2] += currentParticle.deltaColour[2];
					var a = currentParticle.colour[3] += currentParticle.deltaColour[3];

					// Calculate the rgba string to draw.
					draw = [];
					draw.push("rgba(" + (r > 255 ? 255 : r < 0 ? 0 : ~~r));
					draw.push(g > 255 ? 255 : g < 0 ? 0 : ~~g);
					draw.push(b > 255 ? 255 : b < 0 ? 0 : ~~b);
					draw.push((a > 1 ? 1 : a < 0 ? 0 : a.toFixed(2)) + ")");
					currentParticle.drawColour = draw.join(",");

					if (!this.fastMode) {
						draw[3] = "0)";
						currentParticle.drawColourEnd = draw.join(",");
					}

					this.particleIndex++;
				} else {
					// Replace particle with the last active 
					if (this.particleIndex != this.particleCount - 1) {
						this.particles[this.particleIndex] = this.particles[this.particleCount - 1];
					}
					this.particleCount--;
				}
				var rect = {};
				rect._x = ~~currentParticle.position.x;
				rect._y = ~~currentParticle.position.y;
				rect._w = currentParticle.size;
				rect._h = currentParticle.size;

				this.register.push(rect);
			}
		},

		stop: function () {
			this.active = false;
			this.elapsedFrames = 0;
			this.emitCounter = 0;
		},

		render: function (context) {

			for (var i = 0, j = this.particleCount; i < j; i++) {
				var particle = this.particles[i];
				var size = particle.size;
				var halfSize = size >> 1;

				if (particle.position.x + size < 0 
					|| particle.position.y + size < 0 
					|| particle.position.x - size > Crafty.viewport.width 
					|| particle.position.y - size > Crafty.viewport.height) {
					//Particle is outside
					continue;
				}
				var x = ~~particle.position.x;
				var y = ~~particle.position.y;

				if (this.fastMode) {
					context.fillStyle = particle.drawColour;
				} else {
					var radgrad = context.createRadialGradient(x + halfSize, y + halfSize, particle.sizeSmall, x + halfSize, y + halfSize, halfSize);
					radgrad.addColorStop(0, particle.drawColour);
					//0.9 to avoid visible boxing
					radgrad.addColorStop(0.9, particle.drawColourEnd);
					context.fillStyle = radgrad;
				}
				context.fillRect(x, y, size, size);
			}
		},
		particle: function (vectorHelpers) {
			this.position = vectorHelpers.create(0, 0);
			this.direction = vectorHelpers.create(0, 0);
			this.size = 0;
			this.sizeSmall = 0;
			this.timeToLive = 0;
			this.colour = [];
			this.drawColour = "";
			this.deltaColour = [];
			this.sharpness = 0;
		},
		vectorHelpers: {
			create: function (x, y) {
				return {
					"x": x,
					"y": y
				};
			},
			multiply: function (vector, scaleFactor) {
				vector.x *= scaleFactor;
				vector.y *= scaleFactor;
				return vector;
			},
			add: function (vector1, vector2) {
				vector1.x += vector2.x;
				vector1.y += vector2.y;
				return vector1;
			}
		}
	}
});Crafty.extend({
	/**@
	* #Crafty.audio
	* @category Audio
	* Add sound files and play them. Chooses best format for browser support.
	* Due to the nature of HTML5 audio, three types of audio files will be 
	* required for cross-browser capabilities. These formats are MP3, Ogg and WAV.
	*/
	audio: {
		_elems: {},
		_muted: false,
		
		/**@
		* #Crafty.audio.MAX_CHANNELS
		* @comp Crafty.audio
		* Amount of Audio objects for a sound so overlapping of the 
		* same sound can occur. More channels means more of the same sound
		* playing at the same time.
		*/
		MAX_CHANNELS: 5,
		
		type: {
			'mp3': 'audio/mpeg;',
			'ogg': 'audio/ogg; codecs="vorbis"',
			'wav': 'audio/wav; codecs="1"',
			'mp4': 'audio/mp4; codecs="mp4a.40.2"'
		},
		
		/**@
		* #Crafty.audio.add
		* @comp Crafty.audio
		* @sign public this Crafty.audio.add(String id, String url)
		* @param id - A string to reffer to sounds
		* @param url - A string pointing to the sound file
		* @sign public this Crafty.audio.add(String id, Array urls)
		* @param urls - Array of urls pointing to different format of the same sound, selecting the first that is playable
		* @sign public this Crafty.audio.add(Object map)
		* @param map - key-value pairs where the key is the `id` and the value is either a `url` or `urls`
		* 
		* Loads a sound to be played. Due to the nature of HTML5 audio, 
		* three types of audio files will be required for cross-browser capabilities. 
		* These formats are MP3, Ogg and WAV.
		*
		* Passing an array of URLs will determine which format the browser can play and select it over any other.
		*
		* Accepts an object where the key is the audio name and 
		* either a URL or an Array of URLs (to determine which type to use).
		*
		* The ID you use will be how you refer to that sound when using `Crafty.audio.play`.
		*
		* @example
		* ~~~
		* //adding audio from an object
		* Crafty.audio.add({
		* 	shoot: ["sounds/shoot.wav",  
		* 			"sounds/shoot.mp3", 
		* 			"sounds/shoot.ogg"],
		* 
		* 	coin: "sounds/coin.mp3"
		* });
		* 
		* //adding a single sound
		* Crafty.audio.add("walk", [
		* 	"sounds/walk.mp3",
		* 	"sounds/walk.ogg",
		* 	"sounds/walk.wav"
		* ]);
		* 
		* //only one format
		* Crafty.audio.add("jump", "sounds/jump.mp3");
		* ~~~
		* @see Crafty.audio.play, Crafty.audio.settings
		*/
		add: function(id, url) {
			if(!Crafty.support.audio) return this;
			
			var elem, 
				key, 
				audio = new Audio(),
				canplay,
				i = 0,
				sounds = [];
						
			//if an object is passed
			if(arguments.length === 1 && typeof id === "object") {
				for(key in id) {
					if(!id.hasOwnProperty(key)) continue;
					
					//if array passed, add fallback sources
					if(typeof id[key] !== "string") {	
						var sources = id[key], i = 0, l = sources.length,
							source;
						
						for(;i<l;++i) {
							source = sources[i];
							//get the file extension
							ext = source.substr(source.lastIndexOf('.')+1).toLowerCase();
							canplay = audio.canPlayType(this.type[ext]);
							
							//if browser can play this type, use it
							if(canplay !== "" && canplay !== "no") {
								url = source;
								break;
							}
						}
					} else {
						url = id[key];
					}
					
					for(;i<this.MAX_CHANNELS;i++) {
						audio = new Audio(url);
						audio.preload = "auto";
						audio.load();
						sounds.push(audio);
					}
					this._elems[key] = sounds;
					if(!Crafty.assets[url]) Crafty.assets[url] = this._elems[key][0];
				}
				
				return this;
			} 
			//standard method
			if(typeof url !== "string") { 
				var i = 0, l = url.length,
					source;
				
				for(;i<l;++i) {
					source = url[i];
					//get the file extension
					ext = source.substr(source.lastIndexOf('.')+1);
					canplay = audio.canPlayType(this.type[ext]);
					
					//if browser can play this type, use it
					if(canplay !== "" && canplay !== "no") {
						url = source;
						break;
					}
				}
			}
			
			//create a new Audio object and add it to assets
			for(;i<this.MAX_CHANNELS;i++) {
				audio = new Audio(url);
				audio.preload = "auto";
				audio.load();
				sounds.push(audio);
			}
			this._elems[id] = sounds;
			if(!Crafty.assets[url]) Crafty.assets[url] = this._elems[id][0];
			
			return this;
		},
		/**@
		* #Crafty.audio.play
		* @sign public this Crafty.audio.play(String id)
		* @sign public this Crafty.audio.play(String id, Number repeatCount)
		* @param id - A string to reffer to sounds
		* @param repeatCount - Repeat count for the file, where -1 stands for repeat forever.
		* 
		* Will play a sound previously added by using the ID that was used in `Crafty.audio.add`.
		* Has a default maximum of 5 channels so that the same sound can play simultaneously unless all of the channels are playing. 
		
		* *Note that the implementation of HTML5 Audio is buggy at best.*
		*
		* @example
		* ~~~
		* Crafty.audio.play("walk");
		*
		* //play and repeat forever
		* Crafty.audio.play("backgroundMusic", -1);
		* ~~~
		* @see Crafty.audio.add, Crafty.audio.settings
		*/
		play: function(id, repeat) {
			if(!Crafty.support.audio) return;
			
			var sounds = this._elems[id],
				sound,
				i = 0, l = sounds.length;
			
			for(;i<l;i++) {
				sound = sounds[i];
				//go through the channels and play a sound that is stopped
				if(sound.ended || !sound.currentTime) {
					sound.play();
					break;
				} else if(i === l-1) { //if all sounds playing, try stop the last one
					sound.currentTime = 0;
					sound.play();
				}
			}
			if (typeof repeat == "number") {
				var j=0;
				//i is still set to the sound we played
				sounds[i].addEventListener('ended', function(){
					if (repeat == -1 || j <= repeat){
						this.currentTime = 0;
						j++;
					}
				}, false);
			}
			return this;
		},
		
		/**@
		* #Crafty.audio.settings
		* @comp Crafty.audio
		* @sign public this Crafty.audio.settings(String id, Object settings)
		* @param id - The audio instance added by `Crafty.audio.add`
		* @param settings - An object where the key is the setting and the value is what to modify the setting with
		* Used to modify settings of the HTML5 `Audio` object. For a list of all the settings available,
		* see the [Mozilla Documentation](https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsIDOMHTMLMediaElement).
		*/
		settings: function(id, settings) {
			//apply to all
			if(!settings) {
				for(var key in this._elems) {
					this.settings(key, id);
				}
				return this;
			}
			
			var sounds = this._elems[id],
				sound,
				setting,
				i = 0, l = sounds.length;
			
			for(var setting in settings) {
				for(;i<l;i++) {
					sound = sounds[i];
					sound[setting] = settings[setting];
				}
			}
			
			return this;
		},
		
		/**@
		* #Crafty.audio.mute
		* @sign public this Crafty.audio.mute(void)
		* Mute or unmute every Audio instance that is playing. Toggles between
		* pausing or playing depending on the state.
		*/
		mute: function() {
			var sounds, sound, i, l, elem;
			
			//loop over every sound
			for(sounds in this._elems) {
				elem = this._elems[sounds];
				
				//loop over every channel for a sound
				for(i = 0, l = elem.length; i < l; ++i) {
					sound = elem[i];
					
					//if playing, stop
					if(!sound.ended && sound.currentTime) {
						if(this._muted) sound.pause();
						else sound.play();
					}
				}
			}
			this._muted = !this._muted;
			return this;
		}
	}
});

//stop sounds on Pause
Crafty.bind("Pause", function() {Crafty.audio.mute()});
Crafty.bind("Unpause", function() {Crafty.audio.mute()});/**@
* #Text
* @category Graphics
* @requires DOM
* Component to draw text inside the body of an entity. Only works for DOM elements.
*/
Crafty.c("Text", {
	_text: "",
	
	init: function() {
		this.bind("Draw", function(e) {
			if(e.type === "DOM") {
				var el = this._element, style = el.style;
				el.innerHTML = this._text;
			}
		});
	},
	
	/**@
	* #.text
	* @comp Text
	* @sign public this .text(String text)
	* @param text - String of text that will be inseretd into the DOM element. Can use HTML.
	* This method will update the text inside the entity. To modify the font, use the `.css` method
	* inherited from the DOM component.
	*/
	text: function(text) {
		if(!text) return this._text;
		this._text = text;
		this.trigger("Change");
		return this;
	}
});Crafty.extend({
	/**@
	* #Crafty.assets
	* @category Assets
	* An object containing every asset used in the current Crafty game. 
	* The key is the URL and the value is the `Audio` or `Image` object.
    *
	* If loading an asset, check that it is in this object first to avoid loading twice.
	* @example
	* ~~~
	* var isLoaded = !!Crafty.assets["images/sprite.png"];
	* ~~~
	*/
	assets: {},
	
	/**@
	* #Crafty.loader
	* @category Assets
	* @sign public void Crafty.load(Array assets, Function onLoad[, Function onProgress, Function onError])
	* @param assets - Array of assets to load (accepts sounds and images)
	* @param onLoad - Callback when the assets are loaded
	* @param onProgress - Callback when an asset is loaded. Contains information about assets loaded
	* @param onError - Callback when an asset fails to load
	* Preloader for all assets. Takes an array of URLs and 
	* adds them to the `Crafty.assets` object.
	* 
	* The `onProgress` function will be passed on object with information about 
	* the progress including how many assets loaded, total of all the assets to 
	* load and a percentage of the progress.
    *
	* `onError` will be passed with the asset that couldn't load.
	* 
	* @example
	* ~~~
	* Crafty.load(["images/sprite.png", "sounds/jump.mp3"], 
	*     function() {
	*         //when loaded
	*         Crafty.scene("main"); //go to main scene
	*     },
	*
	*     function(e) {
	*		  //progress
	*     },
	*
	*     function(e) {
	*	      //uh oh, error loading
	*     }
	* );
	* ~~~
	* @see Crafty.assets
	*/
	load: function(data, oncomplete, onprogress, onerror) {
		var i = 0, l = data.length, current, obj, total = l, j = 0, ext;
		for(;i<l;++i) {
			current = data[i];
			ext = current.substr(current.lastIndexOf('.')+1).toLowerCase();

			if(Crafty.support.audio && (ext === "mp3" || ext === "wav" || ext === "ogg" || ext === "mp4")) {
				obj = new Audio(current);
				//Chrome doesn't trigger onload on audio, see http://code.google.com/p/chromium/issues/detail?id=77794
				if (navigator.userAgent.indexOf('Chrome') != -1) j++;
			} else if(ext === "jpg" || ext === "jpeg" || ext === "gif" || ext === "png") {
				obj = new Image();
				obj.src = current;
			} else {
				total--;
				continue; //skip if not applicable
			}
			
			//add to global asset collection
			this.assets[current] = obj;
			
			obj.onload = function() {
				++j;
				
				//if progress callback, give information of assets loaded, total and percent
				if(onprogress) {
					onprogress.call(this, {loaded: j, total: total, percent: (j / total * 100)});
				}
				if(j === total) {
					if(oncomplete) oncomplete();
				}
			};
			
			//if there is an error, pass it in the callback (this will be the object that didn't load)
			obj.onerror = function() {
				if(onerror) {
					onerror.call(this, {loaded: j, total: total, percent: (j / total * 100)});
				} else {
					j++;
					if(j === total) {
						if(oncomplete) oncomplete();
					}
				}
			};
		}
	}
});})(Crafty,window,window.document);

//  <JasobNoObfs>
//	---------------------------------------------------------------------------
//	jWebSocket Client (uses jWebSocket Server)
//	Copyright (c) 2010 Alexander Schulze, Innotrade GmbH, Herzogenrath
//	---------------------------------------------------------------------------
//	This program is free software; you can redistribute it and/or modify it
//	under the terms of the GNU Lesser General Public License as published by the
//	Free Software Foundation; either version 3 of the License, or (at your
//	option) any later version.
//	This program is distributed in the hope that it will be useful, but WITHOUT
//	ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
//	FITNESS FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for
//	more details.
//	You should have received a copy of the GNU Lesser General Public License along
//	with this program; if not, see <http://www.gnu.org/licenses/lgpl.html>.
//	---------------------------------------------------------------------------
//  </JasobNoObfs>

// ## :#file:*:jWebSocket.js
// ## :#d:en:Implements the jWebSocket Web Client.


// Firefox temporarily used MozWebSocket (why?), anyway, consider this here.
// Since the browserSupportNativeWebSocket method evaluates the existance of
// the window.WebSocket class, this abstraction need to be done on the very top.
// please do not move this lines down.
if( window.MozWebSocket ) {
	window.WebSocket = window.MozWebSocket;
}

//:package:*:jws
//:class:*:jws
//:ancestor:*:-
//:d:en:Implements the basic "jws" name space for the jWebSocket client
//:d:en:including various utility methods.
var jws = {

	//:const:*:VERSION:String:1.0b1 (10820)
	//:d:en:Version of the jWebSocket JavaScript Client
	VERSION: "1.0b1 (10820)",

	//:const:*:NS_BASE:String:org.jwebsocket
	//:d:en:Base namespace
	NS_BASE: "org.jwebsocket",
	NS_SYSTEM: "org.jwebsocket.plugins.system",

	MSG_WS_NOT_SUPPORTED:
		"Unfortunately your browser does neither natively support WebSockets\n" +
		"nor you have the Adobe Flash-PlugIn 10+ installed.\n" +
		"Please download the last recent Adobe Flash Player at http://get.adobe.com/flashplayer.",

	// some namespace global constants

	//:const:*:CUR_TOKEN_ID:Integer:0
	//:d:en:Current token id, incremented per token exchange to assign results.
	CUR_TOKEN_ID: 0,
	//:const:*:JWS_SERVER_SCHEMA:String:ws
	//:d:en:Default schema, [tt]ws[/tt] for un-secured WebSocket-Connections.
	JWS_SERVER_SCHEMA: "ws",
	//:const:*:JWS_SERVER_SSL_SCHEMA:String:wss
	//:d:en:Default schema, [tt]wss[/tt] for secured WebSocket-Connections.
	JWS_SERVER_SSL_SCHEMA: "wss",
	//:const:*:JWS_SERVER_HOST:String:[hostname|localhost|IP-Number]
	//:d:en:Default hostname of current webbite or [tt]localhost|127.0.0.1[/tt] if no hostname can be detected.
	JWS_SERVER_HOST: ( self.location.hostname ? self.location.hostname : "127.0.0.1" ),
	//:const:*:JWS_SERVER_PORT:Integer:8787
	//:d:en:Default port number, 8787 for stand-alone un-secured servers, _
	//:d:en:80 for Jetty or Glassfish un-secured servers.
	JWS_SERVER_PORT: 8787,
	//:const:*:JWS_SERVER_SSL_PORT:Integer:9797
	//:d:en:Default port number, 9797 for stand-alone SSL secured servers, _
	//:d:en:443 for Jetty or Glassfish SSL secured servers.
	JWS_SERVER_SSL_PORT: 9797,
	//:const:*:JWS_SERVER_CONTEXT:String:jWebSocket
	//:d:en:Default application context in web application servers or servlet containers like Jetty or GlassFish.
	JWS_SERVER_CONTEXT: "/jWebSocket",
	//:const:*:JWS_SERVER_SERVLET:String:jWebSocket
	//:d:en:Default servlet in web application servers or servlet containers like Jetty or GlassFish.
	JWS_SERVER_SERVLET: "/jWebSocket",
	//:const:*:JWS_SERVER_URL:String:ws://[hostname]/jWebSocket/jWebSocket:8787
	//:d:en:Current token id, incremented per token exchange to assign results.
	//:@deprecated:en:Use [tt]getDefaultServerURL()[/tt] instead.
	JWS_SERVER_URL:
		"ws://" + ( self.location.hostname ? self.location.hostname : "127.0.0.1" ) + ":8787/jWebSocket/jWebSocket",

	//:const:*:CONNECTING:Integer:0
	//:d:en:The connection has not yet been established.
	CONNECTING: 0,
	//:const:*:OPEN:Integer:1
	//:d:en:The WebSocket connection is established and communication is possible.
	OPEN: 1,
	//:const:*:CLOSING:Integer:2
	//:d:en:The connection is going through the closing handshake.
	CLOSING: 2,
	//:const:*:CLOSED:Integer:3
	//:d:en:The connection has been closed or could not be opened.
	CLOSED: 3,

	//:const:*:RECONNECTING:Integer:1000
	//:d:en:The connection manager is trying to re-connect, but not yet connected. _
	//:d:en:This is jWebSocket specific and not part of the W3C API.
	RECONNECTING: 1000,

	// Default connection reliability options
	RO_OFF: {
		autoReconnect : false,
		reconnectDelay: -1,
		reconnectTimeout: -1,
		queueItemLimit: -1,
		queueSizeLimit: -1
	},

	RO_ON: {
		autoReconnect: true,
		reconnectDelay: 500,
		reconnectTimeout: 30000,
		queueItemLimit: 1000,
		queueSizeLimit: 1024 * 1024 * 10 // 10 MByte
	},

	//:const:*:WS_SUBPROT_JSON:String:org.jwebsocket.json
	//:d:en:jWebSocket sub protocol JSON
	WS_SUBPROT_JSON: "org.jwebsocket.json",
	//:const:*:WS_SUBPROT_XML:String:org.jwebsocket.xml
	//:d:en:jWebSocket sub protocol XML
	WS_SUBPROT_XML: "org.jwebsocket.xml",
	//:const:*:WS_SUBPROT_CSV:String:org.jwebsocket.csv
	//:d:en:jWebSocket sub protocol CSV
	WS_SUBPROT_CSV: "org.jwebsocket.csv",
	//:const:*:WS_SUBPROT_CUSTOM:String:org.jwebsocket.text
	//:d:en:jWebSocket sub protocol text
	//:@deprecated:en:Use [tt]WS_SUBPROT_TEXT()[/tt] instead.
	WS_SUBPROT_CUSTOM: "org.jwebsocket.text",
	//:const:*:WS_SUBPROT_TEXT:String:org.jwebsocket.text
	//:d:en:jWebSocket sub protocol text
	WS_SUBPROT_TEXT: "org.jwebsocket.text",
	//:const:*:WS_SUBPROT_BINARY:String:org.jwebsocket.binary
	//:d:en:jWebSocket sub protocol binary
	WS_SUBPROT_BINARY: "org.jwebsocket.binary",

	//:const:*:SCOPE_PRIVATE:String:private
	//:d:en:private scope, only authenticated user can read and write his personal items
	SCOPE_PRIVATE: "private",
	//:const:*:SCOPE_PUBLIC:String:public
	//:d:en:public scope, everybody can read and write items from this scope
	SCOPE_PUBLIC: "public",

	//:const:*:DEF_RESP_TIMEOUT:integer:30000
	//:d:en:Default timeout in milliseconds for waiting on asynchronous responses.
	//:d:en:An individual timeout can be passed per request.
	DEF_RESP_TIMEOUT: 30000,


	//:i:en:Browsertype Constants
	//:const:*:BT_UNKNOWN
	//:d:en:Browsertype is unknown.
	BT_UNKNOWN		:  0,
	//:const:*:BT_FIREFOX
	//:d:en:Browser is "Firefox".
	BT_FIREFOX		:  1,
	//:const:*:BT_NETSCAPE
	//:d:en:Browser is "Netscape".
	BT_NETSCAPE		:  2,
	//:const:*:BT_OPERA
	//:d:en:Browser is "Opera".
	BT_OPERA		:  3,
	//:const:*:BT_IEXPLORER
	//:d:en:Browser is "Internet Explorer".
	BT_IEXPLORER	:  4,
	//:const:*:BT_SAFARI
	//:d:en:Browser is "Safari".
	BT_SAFARI		:  5,
	//:const:*:BT_CHROME
	//:d:en:Browser is "Chrome".
	BT_CHROME		: 6,

	//:const:*:BROWSER_NAMES
	//:d:en:Array of browser names. Each BT_xxx constant can be used as an index to this array.
	BROWSER_NAMES : [
		"Unknown",
		"Firefox",
		"Netscape",
		"Opera",
		"Internet Explorer",
		"Safari",
		"Chrome"
	],

	//:const:*:GUEST_USER_LOGINNAME:String:guest
	//:d:en:Guest user login name is "guest" (if not changed on the server).
	GUEST_USER_LOGINNAME: "guest",
	//:const:*:GUEST_USER_PASSWORD:String:guest
	//:d:en:Guest user password is "guest" (if not changed on the server).
	GUEST_USER_PASSWORD: "guest",

	//:m:*:$
	//:d:en:Convenience replacement for [tt]document.getElementById()[/tt]. _
	//:d:en:Returns the first HTML element with the given id or [tt]null[/tt] _
	//:d:en:if the element could not be found.
	//:a:en::aId:String:id of the HTML element to be returned.
	//:r:*:::void:none
	$: function( aId ) {
		return document.getElementById( aId );
	},

	//:m:*:getServerURL
	//:d:en:Returns the URL to the jWebSocket based on schema, host, port, _
	//:d:en:context and servlet.
	//:a:en::voide::
	//:r:*:::void:jWebSocket server URL consisting of schema://host:port/context/servlet
	getServerURL: function( aSchema, aHost, aPort, aContext, aServlet ) {
		var lURL =
			aSchema + "://"
			+ aHost
			+ ( aPort ? ":" + aPort : "" );
		if( aContext && aContext.length > 0 ) {
			lURL += aContext;
			if( aServlet && aServlet.length > 0 ) {
				lURL += aServlet;
			}
		}
		return lURL;
	},

	//:m:*:getDefaultServerURL
	//:d:en:Returns the default URL to the un-secured jWebSocket Server. This is a convenience _
	//:d:en:method used in all jWebSocket demo dialogs. In case of changes to the _
	//:d:en:server URL you only need to change to above JWS_SERVER_xxx constants.
	//:a:en::voide::
	//:r:*:::void:Default jWebSocket server URL consisting of schema://host:port/context/servlet
	getDefaultServerURL: function() {
		return( this.getServerURL(
			jws.JWS_SERVER_SCHEMA,
			jws.JWS_SERVER_HOST,
			jws.JWS_SERVER_PORT,
			jws.JWS_SERVER_CONTEXT,
			jws.JWS_SERVER_SERVLET
		));
	},

	//:m:*:getDefaultSSLServerURL
	//:d:en:Returns the default URL to the secured jWebSocket Server. This is a convenience _
	//:d:en:method used in all jWebSocket demo dialogs. In case of changes to the _
	//:d:en:server URL you only need to change to above JWS_SERVER_xxx constants.
	//:a:en::voide::
	//:r:*:::void:Default jWebSocket server URL consisting of schema://host:port/context/servlet
	getDefaultSSLServerURL: function() {
		return( this.getServerURL(
			jws.JWS_SERVER_SSL_SCHEMA,
			jws.JWS_SERVER_HOST,
			jws.JWS_SERVER_SSL_PORT,
			jws.JWS_SERVER_CONTEXT,
			jws.JWS_SERVER_SERVLET
		));
	},

	//:m:*:browserSupportsWebSockets
	//:d:en:checks if the browser or one of its plug-ins like flash or chrome _
	//:d:en:do support web sockets to be used by an application.
	//:a:en::::none
	//:r:*:::boolean:true if the browser or one of its plug-ins support websockets, otherwise false.
	browserSupportsWebSockets: function() {
		return(
			window.WebSocket !== null && window.WebSocket !== undefined
		);
	},

	//:m:*:browserSupportsNativeWebSockets
	//:d:en:checks if the browser natively supports web sockets, no plug-ins
	//:d:en:are considered. Caution! This is a public field not a function!
	//:a:en::::none
	//:r:*:::boolean:true if the browser natively support websockets, otherwise false.
	browserSupportsNativeWebSockets: (function() {
		return(
			window.WebSocket !== null && window.WebSocket !== undefined
		);
	})(),

	//:m:*:browserSupportsJSON
	//:d:en:checks if the browser natively or by JSON lib does support JSON.
	//:a:en::::none
	//:r:*:::boolean:true if the browser or one of its plug-ins support JSON, otherwise false.
	browserSupportsJSON: function() {
		return(
			window.JSON !== null && window.JSON !== undefined
		);
	},

	//:m:*:browserSupportsNativeJSON
	//:d:en:checks if the browser natively supports JSON, no plug-ins
	//:d:en:are considered. Caution! This is a public field not a function!
	//:a:en::::none
	//:r:*:::boolean:true if the browser natively support websockets, otherwise false.
	browserSupportsNativeJSON: (function() {
		return(
			window.JSON !== null && window.JSON !== undefined
		);
	})(),

	//:m:*:browserSupportsWebWorkers
	//:d:en:checks if the browser natively supports HTML5 WebWorkers
	//:a:en::::none
	//:r:*:::boolean:true if the browser natively support WebWorkers, otherwise false.
	browserSupportsWebWorkers: (function() {
		return(
			window.Worker !== null && window.Worker !== undefined
		);
	})(),

	//:m:*:runAsThread
	//:d:en:checks if the browser natively supports HTML5 WebWorkers
	//:a:en::::none
	//:r:*:::boolean:true if the browser natively support WebWorkers, otherwise false.
	runAsThread: function( aOptions ) {
		// if browser does not support WebWorkers nothing can be done here
		if ( !this.browserSupportsWebWorkers ) {
			return {
				code: -1,
				msg: "Browser does not (yet) support WebWorkers."
			};
		}
		// check if options were passed
		if( !aOptions ) {
			aOptions = {};
		}
		// set default options
		var lOnMessage = null;
		var lOnError = null;
		var lFile = jws.SCRIPT_PATH + "jwsWorker.js";
		var lMethod = null;
		var lArgs = [];
		// checked options passed
		if( aOptions.OnMessage && typeof aOptions.OnMessage == "function" ) {
			lOnMessage = aOptions.OnMessage;
		}
		if( aOptions.OnError && typeof aOptions.OnError == "function" ) {
			lOnError = aOptions.OnError;
		}
		if( aOptions.file && typeof aOptions.file == "String" ) {
			lFile = aOptions.file;
		}
		if( aOptions.method && typeof aOptions.method == "function" ) {
			lMethod = aOptions.method;
		}
		if( aOptions.args ) {
			lArgs = aOptions.args;
		}
		// TODO:
		// check lArgs for type, if needed convert to array

		var lThis = this;
		// create worker object if required
		if( !jws.worker ) {
			jws.worker = new Worker( lFile );

			// This listener is called when a message from the thread
			// to the application is posted.
			jws.worker.onmessage = function( aEvent ) {
				if( lOnMessage != null ) {
					lOnMessage.call( lThis, {
						data: aEvent.data
					});
				}
				// console.log( "Worker message: " + JSON.stringify( aEvent.data ) );
			};

			// This listener is called when an error
			// occurred within the thread.
			jws.worker.onerror = function( aEvent ) {
				if( lOnError != null ) {
					lOnError.call( lThis, {
						message: aEvent.message
					});
				}
				// console.log( "Worker error: " + aEvent.message );
			};
		}

		jws.worker.postMessage({
			// instance: lThis,
			method: lMethod.toString(),
			args: lArgs
		});

		return {
			code: 0,
			msg: "ok",
			worker: jws.worker
		};
	},

	SCRIPT_PATH: (function() {
		var lScripts = document.getElementsByTagName( "script" );
		for( var lIdx = 0, lCnt = lScripts.length; lIdx < lCnt; lIdx++ ) {
			var lScript = lScripts[ lIdx ];
			var lPath = lScript.src;
			if( !lPath ) {
				lPath = lScript.getAttribute( "src" );
			}
			if( lPath ) {
				var lPos = lPath.lastIndexOf( "jWebSocket" );
				if( lPos > 0 ) {
					return lPath.substr( 0, lPos );
				}
			}
		}
		return null;
	})(),

	//:m:*:isIE
	//:d:en:checks if the browser is Internet Explorer. _
	//:d:en:This is needed to switch to IE specific event model.
	//:a:en::::none
	//:r:*:::boolean:true if the browser is IE, otherwise false.
	isIE: (function() {
		var lUserAgent = navigator.userAgent;
		var lIsIE = lUserAgent.indexOf( "MSIE" );
		return( lIsIE >= 0 );
	})(),

	//:i:de:Bei Erweiterung der Browsertypen auch BROWSER_NAMES entsprechend anpassen!

	//:m:*:getBrowserName
	//:d:de:Liefert den Namen des aktuell verwendeten Browser zur&uuml;ck.
	//:d:en:Returns the name of the browser.
	//:a:*::-
	//:r:de::browserName:String:Name des verwendeten Broswers.
	//:r:en::browserName:String:Name of the used browser.
	getBrowserName: function() {
		return this.fBrowserName;
	},

	//:m:*:getBrowserVersion
	//:d:de:Liefert die Browserversion als Flie&szlig;kommazahl zur&uuml;ck.
	//:d:en:Returns the browser version als float value.
	//:a:*::-
	//:r:de::browserVersion:Float:Die Versions Nummer des Browsers.
	//:r:en::browserVersion:Float:Version number of the browser.
	getBrowserVersion: function() {
		return this.fBrowserVerNo;
	},

	//:m:*:getBrowserVersionString
	//:d:de:Liefert die Browserversion als String zur&uuml;ck.
	//:d:en:Returns the browser version as string value.
	//:a:*::-
	//:r:de:::String:Die Versions Nummer des Browsers als String.
	//:r:en:::String:Version string of the browser.
	getBrowserVersionString: function() {
		return this.fBrowserVerStr;
	},

	//:m:*:isFirefox
	//:d:de:Ermittelt, ob der verwendete Browser von Typ "Firefox" ist.
	//:d:en:Determines, if the used browser is a "Firefox".
	//:a:*::-
	//:r:de::isFirefox:Boolean:true, wenn der Browser Firefox ist, andernfalls false.
	//:r:en::isFirefox:Boolean:true, if Browser is Firefox, otherwise false.
	isFirefox: function() {
		return this.fIsFirefox;
	},

	//:m:*:isOpera
	//:d:de:Ermittelt, ob der verwendete Browser von Typ "Opera" ist.
	//:d:en:Determines, if the used browser is a "Opera".
	//:a:*::-
	//:r:de::isOpera:Boolean:true, wenn der Browser Opera ist, andernfalls false.
	//:r:en::isOpera:Boolean:true, if Browser is Opera, otherwise false.
	isOpera: function() {
		return this.fIsOpera;
	},

	//:m:*:isChrome
	//:d:de:Ermittelt, ob der verwendete Browser von Typ "Chrome" ist.
	//:d:en:Determines, if the used browser is a "Chrome".
	//:a:*::-
	//:r:de::isOpera:Boolean:true, wenn der Browser Chrome ist, andernfalls false.
	//:r:en::isOpera:Boolean:true, if Browser is Chrome, otherwise false.
	isChrome: function() {
		return this.fIsChrome;
	},

	//:m:*:isIExplorer
	//:d:de:Ermittelt, ob der verwendete Browser von Typ "Internet Explorer" ist.
	//:d:en:Determines, if the used browser is a "Internet Explorer".
	//:a:*::-
	//:r:de::isIExplorer:Boolean:true, wenn der Browser Internet Explorer ist, andernfalls false.
	//:r:en::isIExplorer:Boolean:true, if Browser is Internet Explorer, otherwise false.
	isIExplorer: function() {
		return this.fIsIExplorer;
	},

	isIE_LE6: function() {
		return( this.isIExplorer() && this.getBrowserVersion() < 7 );
	},

	isIE_LE7: function() {
		return( this.isIExplorer() && this.getBrowserVersion() < 8 );
	},

	isIE_GE8: function() {
		return( this.isIExplorer() && this.getBrowserVersion() >= 8 );
	},

	//:m:*:isSafari
	//:d:de:Ermittelt, ob der verwendete Browser von Typ "Safari" ist.
	//:d:en:Determines, if the used browser is a "Safari".
	//:a:*::-
	//:r:de::isSafari:Boolean:true, wenn der Browser Safari ist, andernfalls false.
	//:r:en::isSafari:Boolean:true, if Browser is Safari, otherwise false.
	isSafari: function() {
		return this.fIsSafari;
	},

	//:m:*:isNetscape
	//:d:de:Ermittelt, ob der verwendete Browser von Typ "Netscape" ist.
	//:d:en:Determines, if the used browser is a "Netscape".
	//:a:*::-
	//:r:de:::Boolean:true, wenn der Browser Netscape ist, andernfalls false.
	//:r:en:::Boolean:true, if Browser is Netscape, otherwise false.
	isNetscape: function() {
		return this.fIsNetscape;
	},

	//:m:de:isPocketIE
	//:d:de:...
	//:d:en:...
	//:a:*::-
	//:r:de::isPocketIE:Boolean:true, wenn der Browser Pocket Internet Explorer ist, andernfalls false.
	//:r:en::isPocketIE:Boolean:true, if Browser is Pocket Internet Explorer, otherwise false.
	isPocketIE: function() {
		return this.fIsPocketIE;
	}

};


//i:en:Browser detection (embedded into a function to not polute global namespace...
(function() {

	jws.fBrowserName	= "unknown";
	jws.fBrowserType	= jws.BT_UNKNOWN;
	jws.fBrowserVerNo	= undefined;

	jws.fIsIExplorer	= false;
	jws.fIsFirefox		= false;
	jws.fIsNetscape		= false;
	jws.fIsOpera		= false;
	jws.fIsSafari		= false;
	jws.fIsChrome		= false;

	var lUA = navigator.userAgent;

	//:i:en:First evaluate name of the browser
	jws.fIsChrome = lUA.indexOf( "Chrome" ) >= 0;
	if( jws.fIsChrome ) {
		jws.fBrowserType = jws.BT_CHROME;
	} else {
		jws.fIsSafari = lUA.indexOf( "Safari" ) >= 0;
		if( jws.fIsSafari ) {
			jws.fBrowserType = jws.BT_SAFARI;
		}
		else {
			jws.fIsNetscape = lUA.indexOf( "Netscape" ) >= 0;
			if( jws.fIsNetscape ) {
				jws.fBrowserType = jws.BT_NETSCAPE;
			} else {
				jws.fIsFirefox = navigator.appName == "Netscape";
				if( jws.fIsFirefox ) {
					jws.fBrowserType = jws.BT_FIREFOX;
				} else {
					jws.fIsOpera = navigator.appName == "Opera";
					if( jws.fIsOpera ) {
						jws.fBrowserType = jws.BT_OPERA;
					} else {
						jws.fIsIExplorer = navigator.appName == "Microsoft Internet Explorer";
						if( jws.fIsIExplorer ) {
							jws.fBrowserType = jws.BT_IEXPLORER;
						} else {
							jws.fIsPocketIE = navigator.appName == "Microsoft Pocket Internet Explorer";
							if( jws.fIsPocketIE ) {
								jws.fBrowserType = jws.BT_IEXPLORER;
							}
						}
					}
				}
			}
		}
	}

	var p, i;
	var lStr;
	var lFound;
	var lVersion;

	if( jws.fIsIExplorer ) {
		//:i:de:Beispiel f&uuml;r userAgent bei IE6:
		//:i:de:"Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; SV1; .NET CLR 1.1.4322; .NET CLR 2.0.50727)"
		jws.fBrowserName = jws.BROWSER_NAMES[ jws.BT_IEXPLORER ];
		lVersion = lUA.match( /MSIE.*/i );
		if ( lVersion ) {
			lStr = lVersion[ 0 ].substr( 5 );
			p = lStr.indexOf( ";" );
			jws.fBrowserVerStr = p > 0 ? lStr.substr( 0, p ) : lStr;
			jws.fBrowserVerNo = parseFloat( jws.fBrowserVerStr );
		}
	} else if( jws.fIsFirefox ) {
		jws.fBrowserName = jws.BROWSER_NAMES[ jws.BT_FIREFOX ];
		//:i:de:Beispiel f&uuml;r userAgent bei FF 2.0.0.11:
		//:i:de:"Mozilla/5.0 (Windows; U; Windows NT 5.1; de; rv:1.8.1.11) Gecko/20071127 Firefox/2.0.0.11"
		lVersion = lUA.match( /Firefox\/.*/i );
		if ( lVersion ) {
			lStr = lVersion[ 0 ].substr( 8 );
			p = lStr.indexOf( " " );
			if( p > 0 ) {
				jws.fBrowserVerStr = lStr.substring( 0, p );
			} else	{
				jws.fBrowserVerStr = lStr;
			}
			lFound = 0;
			i = 0;
			while( i < lStr.length ) {
				if( lStr.charAt( i ) == '.' ) {
					lFound++;
				}
				if( lFound >= 2 ) {
					break;
				}
				i++;
			}
			lStr = lStr.substring( 0, i );
			jws.fBrowserVerNo = parseFloat( lStr );
		}
	}
	else if( jws.fIsNetscape ) {
		jws.fBrowserName = jws.BROWSER_NAMES[ jws.BT_NETSCAPE ];
		//:i:de:Beispiel f&uuml;r userAgent bei FF 2.0.0.11:
		//:i:de:"Mozilla/5.0 (Windows; U; Windows NT 5.1; de; rv:1.8.1.11) Gecko/20071127 Firefox/2.0.0.11"
		lVersion = lUA.match( /Netscape\/.*/i );
		if ( lVersion ) {
			lStr = lVersion[ 0 ].substr( 9 );
			p = lStr.indexOf( " " );
			if( p > 0 ) {
				jws.fBrowserVerStr = lStr.substring( 0, p );
			} else {
				jws.fBrowserVerStr = lStr;
			}
			lFound = 0;
			i = 0;
			while( i < lStr.length ) {
				if( lStr.charAt( i ) == '.' ) {
					lFound++;
				}
				if( lFound >= 2 ) {
					break;
				}
				i++;
			}
			lStr = lStr.substring( 0, i );
			jws.fBrowserVerNo = parseFloat( lStr );
		}
	} else if( jws.fIsOpera ) {
		//:i:de:Beispiel f&uuml;r userAgent bei Opera 9.24
		//:i:de:Opera/9.24 (Windows NT 5.1; U; en)
		jws.fBrowserName = jws.BROWSER_NAMES[ jws.BT_OPERA ];
		lVersion = lUA.match( /Opera\/.*/i );
		if ( lVersion ) {
			lStr = lVersion[ 0 ].substr( 6 );
			p = lStr.indexOf( " " );
			jws.fBrowserVerStr = p > 0 ? lStr.substr( 0, p ) : lStr;
			jws.fBrowserVerNo = parseFloat( lStr );
			// since 10.0 opera provides a separate "version" field
			lVersion = lUA.match( /Version\/.*/i );
			lStr = lVersion[ 0 ].substr( 8 );
			if ( lVersion ) {
				p = lStr.indexOf( " " );
				jws.fBrowserVerStr = ( p > 0 ? lStr.substr( 0, p ) : lStr ) + "/" + jws.fBrowserVerStr;
				jws.fBrowserVerNo = parseFloat( lStr );
			}
		}
	} else if( jws.fIsChrome ) {
		//:i:de:Beispiel f&uuml;r userAgent bei Chrome 4.0.211.7
		//:i:de:Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US) AppleWebKit/532.0 (KHTML, like Gecko) Chrome/4.0.211.7 Safari/532.0
		jws.fBrowserName = jws.BROWSER_NAMES[ jws.BT_CHROME ];
		lVersion = lUA.match( /Chrome\/.*/i );
		if ( lVersion ) {
			lStr = lVersion[ 0 ].substr( 7 );
			p = lStr.indexOf( " " );
			jws.fBrowserVerStr = p > 0 ? lStr.substr( 0, p ) : lStr;
			jws.fBrowserVerNo = parseFloat( lStr );
		}
	} else if( jws.fIsSafari ) {
		jws.fBrowserName = jws.BROWSER_NAMES[ jws.BT_SAFARI ];
		//:i:de:Beispiel f&uuml;r userAgent bei Safari 3.0.4 (523.15):
		//:i:de:"Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US) AppleWebKit/523.15 (KHTML, like Gecko) Version/3.0 Safari/523.15"
		lVersion = lUA.match( /Version\/.*/i );
		if ( lVersion ) {
			lStr = lVersion[ 0 ].substr( 8 );
			p = lStr.indexOf( " " );
			jws.fBrowserVerStr = p > 0 ? lStr.substr( 0, p ) : lStr;

			lFound = 0;
			i = 0;
			while( i < lStr.length ) {
				if( lStr.charAt( i ) == '.' ) {
					lFound++;
				}
				if( lFound >= 2 ) {
					break;
				}
				i++;
			}
			lStr = lStr.substring( 0, i );
			jws.fBrowserVerNo = parseFloat( lStr );

			lVersion = lUA.match( /Safari\/.*/i );
			if ( lVersion ) {
				lStr = "." + lVersion[ 0 ].substr( 7 );
				p = lStr.indexOf( " " );
				jws.fBrowserVerStr += p > 0 ? lStr.substr( 0, p ) : lStr;
			}
		}
	}
}());



//:package:*:jws.events
//:class:*:jws.events
//:ancestor:*:-
//:d:en:Implements event abstraction for Internet Explorer.
jws.events = {

	//:m:*:addEventListener
	//:d:en:Adds a listener (callback) to an event in a cross-browser compatible way.
	//:a:en::aElement:Node:Source element that fires events.
	//:a:en::aEvent:String:Name of the event as a string.
	//:a:en::aListener:Function:The listener function which is called in case of the event.
	//:r:*:::void:none
	addEventListener : (
		jws.isIE ?
			function( aElement, aEvent, aListener ) {
				aElement.attachEvent( "on" + aEvent, aListener);
			}
		:
			function( aElement, aEvent, aListener ) {
				aElement.addEventListener( aEvent, aListener, false );
			}
	),

	// :d:en:Removes a listener (callback) from an event in a cross-browser compatible way.
	// :a:en::aElement:Node:Source element that fires events.
	// :a:en::aEvent:String:Name of the event as a string.
	// :a:en::aListener:Function:The listener function which is called in case of the event.

	//:m:*:getTarget
	//:d:en:Returns the element which originally fired the event in a cross-browser compatible way.
	//:r:*:::Node:Element that originally fired the event.
	getTarget : (
		jws.isIE ?
			function( aEvent ) {
				return aEvent.srcElement;
			}
		:
			function( aEvent ) {
				return aEvent.target;
			}
	),

	preventDefault : (
		jws.isIE ?
			function( aEvent ) {
				aEvent = window.event;
				if( aEvent ) {
					aEvent.returnValue = false;
				}
			}
		:
			function( aEvent ) {
				return aEvent.preventDefault();
			}
	)

};

//  <JasobNoObfs>
/*
 * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
 * Digest Algorithm, as defined in RFC 1321.
 * Version 2.2 Copyright (C) Paul Johnston 1999 - 2009
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for more info.
 * For full source please refer to: md5.js
 */
var hexcase=0;var b64pad="";function hex_md5(s){return rstr2hex(rstr_md5(str2rstr_utf8(s)));};function b64_md5(s){return rstr2b64(rstr_md5(str2rstr_utf8(s)));};function any_md5(s,e){return rstr2any(rstr_md5(str2rstr_utf8(s)),e);};function hex_hmac_md5(k,d){return rstr2hex(rstr_hmac_md5(str2rstr_utf8(k),str2rstr_utf8(d)));};function b64_hmac_md5(k,d){return rstr2b64(rstr_hmac_md5(str2rstr_utf8(k),str2rstr_utf8(d)));};function any_hmac_md5(k,d,e){return rstr2any(rstr_hmac_md5(str2rstr_utf8(k),str2rstr_utf8(d)),e);};function md5_vm_test(){return hex_md5("abc").toLowerCase()=="900150983cd24fb0d6963f7d28e17f72";};function rstr_md5(s){return binl2rstr(binl_md5(rstr2binl(s),s.length*8));};function rstr_hmac_md5(key,data){var bkey=rstr2binl(key);if(bkey.length>16)bkey=binl_md5(bkey,key.length*8);var ipad=Array(16),opad=Array(16);for(var i=0;i<16;i++){ipad[i]=bkey[i]^0x36363636;opad[i]=bkey[i]^0x5C5C5C5C;}var hash=binl_md5(ipad.concat(rstr2binl(data)),512+data.length*8);return binl2rstr(binl_md5(opad.concat(hash),512+128));};function rstr2hex(input){try{hexcase}catch(e){hexcase=0;}var hex_tab=hexcase?"0123456789ABCDEF":"0123456789abcdef";var output="";var x;for(var i=0;i<input.length;i++){x=input.charCodeAt(i);output+=hex_tab.charAt((x>>>4)&0x0F)+hex_tab.charAt(x&0x0F);}return output;};function rstr2b64(input){try{b64pad}catch(e){b64pad='';}var tab="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";var output="";var len=input.length;for(var i=0;i<len;i+=3){var triplet=(input.charCodeAt(i)<<16)|(i+1<len?input.charCodeAt(i+1)<<8:0)|(i+2<len?input.charCodeAt(i+2):0);for(var j=0;j<4;j++){if(i*8+j*6>input.length*8)output+=b64pad;else output+=tab.charAt((triplet>>>6*(3-j))&0x3F);}}return output;};function rstr2any(input,encoding){var divisor=encoding.length;var i,j,q,x,quotient;var dividend=Array(Math.ceil(input.length/2));for(i=0;i<dividend.length;i++){dividend[i]=(input.charCodeAt(i*2)<<8)|input.charCodeAt(i*2+1);}var full_length=Math.ceil(input.length*8/(Math.log(encoding.length)/Math.log(2)));var remainders=Array(full_length);for(j=0;j<full_length;j++){quotient=Array();x=0;for(i=0;i<dividend.length;i++){x=(x<<16)+dividend[i];q=Math.floor(x/divisor);x-=q*divisor;if(quotient.length>0||q>0)quotient[quotient.length]=q;}remainders[j]=x;dividend=quotient;}var output="";for(i=remainders.length-1;i>=0;i--)output+=encoding.charAt(remainders[i]);return output;};function str2rstr_utf8(input){var output="";var i= -1;var x,y;while(++i<input.length){x=input.charCodeAt(i);y=i+1<input.length?input.charCodeAt(i+1):0;if(0xD800<=x&&x<=0xDBFF&&0xDC00<=y&&y<=0xDFFF){x=0x10000+((x&0x03FF)<<10)+(y&0x03FF);i++;}if(x<=0x7F)output+=String.fromCharCode(x);else if(x<=0x7FF)output+=String.fromCharCode(0xC0|((x>>>6)&0x1F),0x80|(x&0x3F));else if(x<=0xFFFF)output+=String.fromCharCode(0xE0|((x>>>12)&0x0F),0x80|((x>>>6)&0x3F),0x80|(x&0x3F));else if(x<=0x1FFFFF)output+=String.fromCharCode(0xF0|((x>>>18)&0x07),0x80|((x>>>12)&0x3F),0x80|((x>>>6)&0x3F),0x80|(x&0x3F));}return output;};function str2rstr_utf16le(input){var output="";for(var i=0;i<input.length;i++)output+=String.fromCharCode(input.charCodeAt(i)&0xFF,(input.charCodeAt(i)>>>8)&0xFF);return output;};function str2rstr_utf16be(input){var output="";for(var i=0;i<input.length;i++)output+=String.fromCharCode((input.charCodeAt(i)>>>8)&0xFF,input.charCodeAt(i)&0xFF);return output;};function rstr2binl(input){var output=Array(input.length>>2);for(var i=0;i<output.length;i++)output[i]=0;for(var i=0;i<input.length*8;i+=8)output[i>>5]|=(input.charCodeAt(i/8)&0xFF)<<(i%32);return output;};function binl2rstr(input){var output="";for(var i=0;i<input.length*32;i+=8)output+=String.fromCharCode((input[i>>5]>>>(i%32))&0xFF);return output;};function binl_md5(x,len){x[len>>5]|=0x80<<((len)%32);x[(((len+64)>>>9)<<4)+14]=len;var a=1732584193;var b= -271733879;var c= -1732584194;var d=271733878;for(var i=0;i<x.length;i+=16){var olda=a;var oldb=b;var oldc=c;var oldd=d;a=md5_ff(a,b,c,d,x[i+0],7,-680876936);d=md5_ff(d,a,b,c,x[i+1],12,-389564586);c=md5_ff(c,d,a,b,x[i+2],17,606105819);b=md5_ff(b,c,d,a,x[i+3],22,-1044525330);a=md5_ff(a,b,c,d,x[i+4],7,-176418897);d=md5_ff(d,a,b,c,x[i+5],12,1200080426);c=md5_ff(c,d,a,b,x[i+6],17,-1473231341);b=md5_ff(b,c,d,a,x[i+7],22,-45705983);a=md5_ff(a,b,c,d,x[i+8],7,1770035416);d=md5_ff(d,a,b,c,x[i+9],12,-1958414417);c=md5_ff(c,d,a,b,x[i+10],17,-42063);b=md5_ff(b,c,d,a,x[i+11],22,-1990404162);a=md5_ff(a,b,c,d,x[i+12],7,1804603682);d=md5_ff(d,a,b,c,x[i+13],12,-40341101);c=md5_ff(c,d,a,b,x[i+14],17,-1502002290);b=md5_ff(b,c,d,a,x[i+15],22,1236535329);a=md5_gg(a,b,c,d,x[i+1],5,-165796510);d=md5_gg(d,a,b,c,x[i+6],9,-1069501632);c=md5_gg(c,d,a,b,x[i+11],14,643717713);b=md5_gg(b,c,d,a,x[i+0],20,-373897302);a=md5_gg(a,b,c,d,x[i+5],5,-701558691);d=md5_gg(d,a,b,c,x[i+10],9,38016083);c=md5_gg(c,d,a,b,x[i+15],14,-660478335);b=md5_gg(b,c,d,a,x[i+4],20,-405537848);a=md5_gg(a,b,c,d,x[i+9],5,568446438);d=md5_gg(d,a,b,c,x[i+14],9,-1019803690);c=md5_gg(c,d,a,b,x[i+3],14,-187363961);b=md5_gg(b,c,d,a,x[i+8],20,1163531501);a=md5_gg(a,b,c,d,x[i+13],5,-1444681467);d=md5_gg(d,a,b,c,x[i+2],9,-51403784);c=md5_gg(c,d,a,b,x[i+7],14,1735328473);b=md5_gg(b,c,d,a,x[i+12],20,-1926607734);a=md5_hh(a,b,c,d,x[i+5],4,-378558);d=md5_hh(d,a,b,c,x[i+8],11,-2022574463);c=md5_hh(c,d,a,b,x[i+11],16,1839030562);b=md5_hh(b,c,d,a,x[i+14],23,-35309556);a=md5_hh(a,b,c,d,x[i+1],4,-1530992060);d=md5_hh(d,a,b,c,x[i+4],11,1272893353);c=md5_hh(c,d,a,b,x[i+7],16,-155497632);b=md5_hh(b,c,d,a,x[i+10],23,-1094730640);a=md5_hh(a,b,c,d,x[i+13],4,681279174);d=md5_hh(d,a,b,c,x[i+0],11,-358537222);c=md5_hh(c,d,a,b,x[i+3],16,-722521979);b=md5_hh(b,c,d,a,x[i+6],23,76029189);a=md5_hh(a,b,c,d,x[i+9],4,-640364487);d=md5_hh(d,a,b,c,x[i+12],11,-421815835);c=md5_hh(c,d,a,b,x[i+15],16,530742520);b=md5_hh(b,c,d,a,x[i+2],23,-995338651);a=md5_ii(a,b,c,d,x[i+0],6,-198630844);d=md5_ii(d,a,b,c,x[i+7],10,1126891415);c=md5_ii(c,d,a,b,x[i+14],15,-1416354905);b=md5_ii(b,c,d,a,x[i+5],21,-57434055);a=md5_ii(a,b,c,d,x[i+12],6,1700485571);d=md5_ii(d,a,b,c,x[i+3],10,-1894986606);c=md5_ii(c,d,a,b,x[i+10],15,-1051523);b=md5_ii(b,c,d,a,x[i+1],21,-2054922799);a=md5_ii(a,b,c,d,x[i+8],6,1873313359);d=md5_ii(d,a,b,c,x[i+15],10,-30611744);c=md5_ii(c,d,a,b,x[i+6],15,-1560198380);b=md5_ii(b,c,d,a,x[i+13],21,1309151649);a=md5_ii(a,b,c,d,x[i+4],6,-145523070);d=md5_ii(d,a,b,c,x[i+11],10,-1120210379);c=md5_ii(c,d,a,b,x[i+2],15,718787259);b=md5_ii(b,c,d,a,x[i+9],21,-343485551);a=safe_add(a,olda);b=safe_add(b,oldb);c=safe_add(c,oldc);d=safe_add(d,oldd);}return Array(a,b,c,d);};function md5_cmn(q,a,b,x,s,t){return safe_add(bit_rol(safe_add(safe_add(a,q),safe_add(x,t)),s),b);};function md5_ff(a,b,c,d,x,s,t){return md5_cmn((b&c)|((~b)&d),a,b,x,s,t);};function md5_gg(a,b,c,d,x,s,t){return md5_cmn((b&d)|(c&(~d)),a,b,x,s,t);};function md5_hh(a,b,c,d,x,s,t){return md5_cmn(b^c^d,a,b,x,s,t);};function md5_ii(a,b,c,d,x,s,t){return md5_cmn(c^(b|(~d)),a,b,x,s,t);};function safe_add(x,y){var lsw=(x&0xFFFF)+(y&0xFFFF);var msw=(x>>16)+(y>>16)+(lsw>>16);return(msw<<16)|(lsw&0xFFFF);};function bit_rol(num,cnt){return(num<<cnt)|(num>>>(32-cnt));}
//  </JasobNoObfs>


//:package:*:jws.tools
//:class:*:jws.tools
//:ancestor:*:-
//:d:en:Implements some required JavaScript tools.
jws.tools = {

	//:m:*:zerofill
	//:d:en:Fills up an integer value with the given number of zero characters
	//:d:en:to support a date time exchange according to ISO 8601
	//:a:en::aInt:Number:Number to be formatted.
	//:a:en::aDigits:Number:Nu,ber of digits for the result.
	//:r:*:::String:String with the exact number of digits filled with 0.
	zerofill: function( aInt, aDigits ) {
		var lRes = aInt.toFixed( 0 );
		if( lRes.length > aDigits ) {
			lRes = lRes.substring( lRes.length - aDigits );
		} else {
			while( lRes.length < aDigits ) {
				lRes = "0" + lRes;
			}
		}
        return lRes;
    },

	calcMD5: function( aUTF8 ) {
		return( hex_md5( aUTF8 ) );
	},

	escapeSQL: function( aValue ) {
		return aValue;
		/*
		if( aValue && typeof aValue == "string" ) {
			// escape single quotes in strings by double single quotes
			return aValue.replace( /[']/g, "''" );
		} else {
			return aValue;
		}
		*/
	},

	date2ISO: function( aDate ) {
		// JavaScript returns negative values for +GMT
		var lTZO = -aDate.getTimezoneOffset();
		var lAbsTZO = Math.abs( lTZO );
		var lRes =
			aDate.getUTCFullYear()
			+ "-"
			+ this.zerofill( aDate.getUTCMonth() + 1, 2 )
			+ "-"
			+ this.zerofill( aDate.getUTCDate(), 2 )
			// use time separator
			+ "T"
			+ this.zerofill( aDate.getUTCHours(), 2 )
			+ ":"
			+ this.zerofill( aDate.getUTCMinutes(), 2 )
			+ ":"
			+ this.zerofill( aDate.getUTCSeconds(), 2 )
			+ "."
			+ this.zerofill( aDate.getUTCMilliseconds(), 3 )
			/*
			+ ( lTZO >= 0 ? "+" : "-" )
			+ this.zerofill( lAbsTZO / 60, 2 )
			+ this.zerofill( lAbsTZO % 60, 2 )
			*/
			// trailing Z means it's UTC
			+ "Z";
		return lRes;
	},

	ISO2Date: function( aISO, aTimezone ) {
		var lDate = new Date();
		// date part
		lDate.setUTCFullYear( aISO.substr( 0, 4 ) );
		lDate.setUTCMonth( aISO.substr( 5, 2 ) - 1 );
		lDate.setUTCDate( aISO.substr( 8, 2 ) );
		// time
		lDate.setUTCHours( aISO.substr( 11, 2 ) );
		lDate.setUTCMinutes( aISO.substr( 14, 2 ) );
		lDate.setUTCSeconds( aISO.substr( 17, 2 ) );
		lDate.setUTCMilliseconds( aISO.substr( 20, 3 ) );
		//:TODO:en:Analyze timezone
		return lDate;
	},

	date2String: function( aDate ) {
		var lRes =
			aDate.getUTCFullYear()
			+ this.zerofill( aDate.getUTCMonth() + 1, 2 )
			+ this.zerofill( aDate.getUTCDate(), 2 )
			+ this.zerofill( aDate.getUTCHours(), 2 )
			+ this.zerofill( aDate.getUTCMinutes(), 2 )
			+ this.zerofill( aDate.getUTCSeconds(), 2 )
			+ this.zerofill( aDate.getUTCMilliseconds(), 2 )
		return lRes;
	},

	string2Date: function( aISO ) {
		var lDate = new Date();
		// date part
		lDate.setUTCFullYear( aISO.substr( 0, 4 ) );
		lDate.setUTCMonth( aISO.substr( 4, 2 ) - 1 );
		lDate.setUTCDate( aISO.substr( 6, 2 ) );
		// time
		lDate.setUTCHours( aISO.substr( 8, 2 ) );
		lDate.setUTCMinutes( aISO.substr( 10, 2 ) );
		lDate.setUTCSeconds( aISO.substr( 12, 2 ) );
		lDate.setUTCMilliseconds( aISO.substr( 14, 3 ) );
		return lDate;
	},

	generateSharedUTID: function(aToken){
		var string = JSON.stringify(aToken);
		var chars = string.split('');
		chars.sort();
		return hex_md5("{" + chars.toString() + "}");
	},

	getType: function(aObject){
		var value = aObject;
		var t = typeof value;

		if ("number" == t){
			if((parseFloat(value) == parseInt(value))){
				t = "integer";
			} else {
				t = "double";
			}
		} else if (Object.prototype.toString.call(value) === "[object Array]") {
			t = "array";
		} else if (value === null) {
			t = "null";
		}
		return t;
	}

};

if( !jws.browserSupportsNativeWebSockets ) {
	//	<JasobNoObfs>
	// --- swfobject.js ---
	// SWFObject v2.2 <http://code.google.com/p/swfobject/>
	// is released under the MIT License <http://www.opensource.org/licenses/mit-license.php>
	var swfobject=function(){var D="undefined",r="object",S="Shockwave Flash",W="ShockwaveFlash.ShockwaveFlash",q="application/x-shockwave-flash",R="SWFObjectExprInst",x="onreadystatechange",O=window,j=document,t=navigator,T=false,U=[h],o=[],N=[],I=[],l,Q,E,B,J=false,a=false,n,G,m=true,M=function(){var aa=typeof j.getElementById!=D&&typeof j.getElementsByTagName!=D&&typeof j.createElement!=D,ah=t.userAgent.toLowerCase(),Y=t.platform.toLowerCase(),ae=Y?/win/.test(Y):/win/.test(ah),ac=Y?/mac/.test(Y):/mac/.test(ah),af=/webkit/.test(ah)?parseFloat(ah.replace(/^.*webkit\/(\d+(\.\d+)?).*$/,"$1")):false,X=!+"\v1",ag=[0,0,0],ab=null;if(typeof t.plugins!=D&&typeof t.plugins[S]==r){ab=t.plugins[S].description;if(ab&&!(typeof t.mimeTypes!=D&&t.mimeTypes[q]&&!t.mimeTypes[q].enabledPlugin)){T=true;X=false;ab=ab.replace(/^.*\s+(\S+\s+\S+$)/,"$1");ag[0]=parseInt(ab.replace(/^(.*)\..*$/,"$1"),10);ag[1]=parseInt(ab.replace(/^.*\.(.*)\s.*$/,"$1"),10);ag[2]=/[a-zA-Z]/.test(ab)?parseInt(ab.replace(/^.*[a-zA-Z]+(.*)$/,"$1"),10):0}}else{if(typeof O.ActiveXObject!=D){try{var ad=new ActiveXObject(W);if(ad){ab=ad.GetVariable("$version");if(ab){X=true;ab=ab.split(" ")[1].split(",");ag=[parseInt(ab[0],10),parseInt(ab[1],10),parseInt(ab[2],10)]}}}catch(Z){}}}return{w3:aa,pv:ag,wk:af,ie:X,win:ae,mac:ac}}(),k=function(){if(!M.w3){return}if((typeof j.readyState!=D&&j.readyState=="complete")||(typeof j.readyState==D&&(j.getElementsByTagName("body")[0]||j.body))){f()}if(!J){if(typeof j.addEventListener!=D){j.addEventListener("DOMContentLoaded",f,false)}if(M.ie&&M.win){j.attachEvent(x,function(){if(j.readyState=="complete"){j.detachEvent(x,arguments.callee);f()}});if(O==top){(function(){if(J){return}try{j.documentElement.doScroll("left")}catch(X){setTimeout(arguments.callee,0);return}f()})()}}if(M.wk){(function(){if(J){return}if(!/loaded|complete/.test(j.readyState)){setTimeout(arguments.callee,0);return}f()})()}s(f)}}();function f(){if(J){return}try{var Z=j.getElementsByTagName("body")[0].appendChild(C("span"));Z.parentNode.removeChild(Z)}catch(aa){return}J=true;var X=U.length;for(var Y=0;Y<X;Y++){U[Y]()}}function K(X){if(J){X()}else{U[U.length]=X}}function s(Y){if(typeof O.addEventListener!=D){O.addEventListener("load",Y,false)}else{if(typeof j.addEventListener!=D){j.addEventListener("load",Y,false)}else{if(typeof O.attachEvent!=D){i(O,"onload",Y)}else{if(typeof O.onload=="function"){var X=O.onload;O.onload=function(){X();Y()}}else{O.onload=Y}}}}}function h(){if(T){V()}else{H()}}function V(){var X=j.getElementsByTagName("body")[0];var aa=C(r);aa.setAttribute("type",q);var Z=X.appendChild(aa);if(Z){var Y=0;(function(){if(typeof Z.GetVariable!=D){var ab=Z.GetVariable("$version");if(ab){ab=ab.split(" ")[1].split(",");M.pv=[parseInt(ab[0],10),parseInt(ab[1],10),parseInt(ab[2],10)]}}else{if(Y<10){Y++;setTimeout(arguments.callee,10);return}}X.removeChild(aa);Z=null;H()})()}else{H()}}function H(){var ag=o.length;if(ag>0){for(var af=0;af<ag;af++){var Y=o[af].id;var ab=o[af].callbackFn;var aa={success:false,id:Y};if(M.pv[0]>0){var ae=c(Y);if(ae){if(F(o[af].swfVersion)&&!(M.wk&&M.wk<312)){w(Y,true);if(ab){aa.success=true;aa.ref=z(Y);ab(aa)}}else{if(o[af].expressInstall&&A()){var ai={};ai.data=o[af].expressInstall;ai.width=ae.getAttribute("width")||"0";ai.height=ae.getAttribute("height")||"0";if(ae.getAttribute("class")){ai.styleclass=ae.getAttribute("class")}if(ae.getAttribute("align")){ai.align=ae.getAttribute("align")}var ah={};var X=ae.getElementsByTagName("param");var ac=X.length;for(var ad=0;ad<ac;ad++){if(X[ad].getAttribute("name").toLowerCase()!="movie"){ah[X[ad].getAttribute("name")]=X[ad].getAttribute("value")}}P(ai,ah,Y,ab)}else{p(ae);if(ab){ab(aa)}}}}}else{w(Y,true);if(ab){var Z=z(Y);if(Z&&typeof Z.SetVariable!=D){aa.success=true;aa.ref=Z}ab(aa)}}}}}function z(aa){var X=null;var Y=c(aa);if(Y&&Y.nodeName=="OBJECT"){if(typeof Y.SetVariable!=D){X=Y}else{var Z=Y.getElementsByTagName(r)[0];if(Z){X=Z}}}return X}function A(){return !a&&F("6.0.65")&&(M.win||M.mac)&&!(M.wk&&M.wk<312)}function P(aa,ab,X,Z){a=true;E=Z||null;B={success:false,id:X};var ae=c(X);if(ae){if(ae.nodeName=="OBJECT"){l=g(ae);Q=null}else{l=ae;Q=X}aa.id=R;if(typeof aa.width==D||(!/%$/.test(aa.width)&&parseInt(aa.width,10)<310)){aa.width="310"}if(typeof aa.height==D||(!/%$/.test(aa.height)&&parseInt(aa.height,10)<137)){aa.height="137"}j.title=j.title.slice(0,47)+" - Flash Player Installation";var ad=M.ie&&M.win?"ActiveX":"PlugIn",ac="MMredirectURL="+O.location.toString().replace(/&/g,"%26")+"&MMplayerType="+ad+"&MMdoctitle="+j.title;if(typeof ab.flashvars!=D){ab.flashvars+="&"+ac}else{ab.flashvars=ac}if(M.ie&&M.win&&ae.readyState!=4){var Y=C("div");X+="SWFObjectNew";Y.setAttribute("id",X);ae.parentNode.insertBefore(Y,ae);ae.style.display="none";(function(){if(ae.readyState==4){ae.parentNode.removeChild(ae)}else{setTimeout(arguments.callee,10)}})()}u(aa,ab,X)}}function p(Y){if(M.ie&&M.win&&Y.readyState!=4){var X=C("div");Y.parentNode.insertBefore(X,Y);X.parentNode.replaceChild(g(Y),X);Y.style.display="none";(function(){if(Y.readyState==4){Y.parentNode.removeChild(Y)}else{setTimeout(arguments.callee,10)}})()}else{Y.parentNode.replaceChild(g(Y),Y)}}function g(ab){var aa=C("div");if(M.win&&M.ie){aa.innerHTML=ab.innerHTML}else{var Y=ab.getElementsByTagName(r)[0];if(Y){var ad=Y.childNodes;if(ad){var X=ad.length;for(var Z=0;Z<X;Z++){if(!(ad[Z].nodeType==1&&ad[Z].nodeName=="PARAM")&&!(ad[Z].nodeType==8)){aa.appendChild(ad[Z].cloneNode(true))}}}}}return aa}function u(ai,ag,Y){var X,aa=c(Y);if(M.wk&&M.wk<312){return X}if(aa){if(typeof ai.id==D){ai.id=Y}if(M.ie&&M.win){var ah="";for(var ae in ai){if(ai[ae]!=Object.prototype[ae]){if(ae.toLowerCase()=="data"){ag.movie=ai[ae]}else{if(ae.toLowerCase()=="styleclass"){ah+=' class="'+ai[ae]+'"'}else{if(ae.toLowerCase()!="classid"){ah+=" "+ae+'="'+ai[ae]+'"'}}}}}var af="";for(var ad in ag){if(ag[ad]!=Object.prototype[ad]){af+='<param name="'+ad+'" value="'+ag[ad]+'" />'}}aa.outerHTML='<object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000"'+ah+">"+af+"</object>";N[N.length]=ai.id;X=c(ai.id)}else{var Z=C(r);Z.setAttribute("type",q);for(var ac in ai){if(ai[ac]!=Object.prototype[ac]){if(ac.toLowerCase()=="styleclass"){Z.setAttribute("class",ai[ac])}else{if(ac.toLowerCase()!="classid"){Z.setAttribute(ac,ai[ac])}}}}for(var ab in ag){if(ag[ab]!=Object.prototype[ab]&&ab.toLowerCase()!="movie"){e(Z,ab,ag[ab])}}aa.parentNode.replaceChild(Z,aa);X=Z}}return X}function e(Z,X,Y){var aa=C("param");aa.setAttribute("name",X);aa.setAttribute("value",Y);Z.appendChild(aa)}function y(Y){var X=c(Y);if(X&&X.nodeName=="OBJECT"){if(M.ie&&M.win){X.style.display="none";(function(){if(X.readyState==4){b(Y)}else{setTimeout(arguments.callee,10)}})()}else{X.parentNode.removeChild(X)}}}function b(Z){var Y=c(Z);if(Y){for(var X in Y){if(typeof Y[X]=="function"){Y[X]=null}}Y.parentNode.removeChild(Y)}}function c(Z){var X=null;try{X=j.getElementById(Z)}catch(Y){}return X}function C(X){return j.createElement(X)}function i(Z,X,Y){Z.attachEvent(X,Y);I[I.length]=[Z,X,Y]}function F(Z){var Y=M.pv,X=Z.split(".");X[0]=parseInt(X[0],10);X[1]=parseInt(X[1],10)||0;X[2]=parseInt(X[2],10)||0;return(Y[0]>X[0]||(Y[0]==X[0]&&Y[1]>X[1])||(Y[0]==X[0]&&Y[1]==X[1]&&Y[2]>=X[2]))?true:false}function v(ac,Y,ad,ab){if(M.ie&&M.mac){return}var aa=j.getElementsByTagName("head")[0];if(!aa){return}var X=(ad&&typeof ad=="string")?ad:"screen";if(ab){n=null;G=null}if(!n||G!=X){var Z=C("style");Z.setAttribute("type","text/css");Z.setAttribute("media",X);n=aa.appendChild(Z);if(M.ie&&M.win&&typeof j.styleSheets!=D&&j.styleSheets.length>0){n=j.styleSheets[j.styleSheets.length-1]}G=X}if(M.ie&&M.win){if(n&&typeof n.addRule==r){n.addRule(ac,Y)}}else{if(n&&typeof j.createTextNode!=D){n.appendChild(j.createTextNode(ac+" {"+Y+"}"))}}}function w(Z,X){if(!m){return}var Y=X?"visible":"hidden";if(J&&c(Z)){c(Z).style.visibility=Y}else{v("#"+Z,"visibility:"+Y)}}function L(Y){var Z=/[\\\"<>\.;]/;var X=Z.exec(Y)!=null;return X&&typeof encodeURIComponent!=D?encodeURIComponent(Y):Y}var d=function(){if(M.ie&&M.win){window.attachEvent("onunload",function(){var ac=I.length;for(var ab=0;ab<ac;ab++){I[ab][0].detachEvent(I[ab][1],I[ab][2])}var Z=N.length;for(var aa=0;aa<Z;aa++){y(N[aa])}for(var Y in M){M[Y]=null}M=null;for(var X in swfobject){swfobject[X]=null}swfobject=null})}}();return{registerObject:function(ab,X,aa,Z){if(M.w3&&ab&&X){var Y={};Y.id=ab;Y.swfVersion=X;Y.expressInstall=aa;Y.callbackFn=Z;o[o.length]=Y;w(ab,false)}else{if(Z){Z({success:false,id:ab})}}},getObjectById:function(X){if(M.w3){return z(X)}},embedSWF:function(ab,ah,ae,ag,Y,aa,Z,ad,af,ac){var X={success:false,id:ah};if(M.w3&&!(M.wk&&M.wk<312)&&ab&&ah&&ae&&ag&&Y){w(ah,false);K(function(){ae+="";ag+="";var aj={};if(af&&typeof af===r){for(var al in af){aj[al]=af[al]}}aj.data=ab;aj.width=ae;aj.height=ag;var am={};if(ad&&typeof ad===r){for(var ak in ad){am[ak]=ad[ak]}}if(Z&&typeof Z===r){for(var ai in Z){if(typeof am.flashvars!=D){am.flashvars+="&"+ai+"="+Z[ai]}else{am.flashvars=ai+"="+Z[ai]}}}if(F(Y)){var an=u(aj,am,ah);if(aj.id==ah){w(ah,true)}X.success=true;X.ref=an}else{if(aa&&A()){aj.data=aa;P(aj,am,ah,ac);return}else{w(ah,true)}}if(ac){ac(X)}})}else{if(ac){ac(X)}}},switchOffAutoHideShow:function(){m=false},ua:M,getFlashPlayerVersion:function(){return{major:M.pv[0],minor:M.pv[1],release:M.pv[2]}},hasFlashPlayerVersion:F,createSWF:function(Z,Y,X){if(M.w3){return u(Z,Y,X)}else{return undefined}},showExpressInstall:function(Z,aa,X,Y){if(M.w3&&A()){P(Z,aa,X,Y)}},removeSWF:function(X){if(M.w3){y(X)}},createCSS:function(aa,Z,Y,X){if(M.w3){v(aa,Z,Y,X)}},addDomLoadEvent:K,addLoadEvent:s,getQueryParamValue:function(aa){var Z=j.location.search||j.location.hash;if(Z){if(/\?/.test(Z)){Z=Z.split("?")[1]}if(aa==null){return L(Z)}var Y=Z.split("&");for(var X=0;X<Y.length;X++){if(Y[X].substring(0,Y[X].indexOf("="))==aa){return L(Y[X].substring((Y[X].indexOf("=")+1)))}}}return""},expressInstallCallback:function(){if(a){var X=c(R);if(X&&l){X.parentNode.replaceChild(l,X);if(Q){w(Q,true);if(M.ie&&M.win){l.style.display="block"}}if(E){E(B)}}a=false}}}}();
	//	</JasobNoObfs>
	//
	// check if appropriate flash version is installed
	if( swfobject.hasFlashPlayerVersion( "10.0.0" ) ) {

	    WEB_SOCKET_DEBUG = true;

		// init flash bridge
		// use function to not polute the namespace with identifiers
		// get all scripts on the page to find jWebSocket.js path
		(function() {
			var lScripts = document.getElementsByTagName( "script" );
			for( var lIdx = 0, lCnt = lScripts.length; lIdx < lCnt; lIdx++ ) {
				var lScript = lScripts[ lIdx ];
				var lPath = lScript.src;
				if( !lPath ) {
					lPath = lScript.getAttribute( "src" );
				}
				if( lPath ) {
					// check for all three versions of jWebSocket.js
					var lPos = lPath.lastIndexOf( "jWebSocket_Bundle_min.js" );
					if( lPos < 0 ) {
						lPos = lPath.lastIndexOf( "jWebSocket_Bundle.js" );
					}
					if( lPos < 0 ) {
						lPos = lPath.lastIndexOf( "jWebSocket.js" );
					}
					if( lPos > 0 ) {
						window.WEB_SOCKET_SWF_LOCATION =
							lPath.substr( 0, lPos ) + "flash-bridge/WebSocketMain.swf";
						jws.JWS_FLASHBRIDGE = window.WEB_SOCKET_SWF_LOCATION;
						break;
					}
				}
			}
		})();

		if( window.WEB_SOCKET_SWF_LOCATION ) {
			//	<JasobNoObfs>
			// --- web_socket.js (minified) ---
			// Copyright: Hiroshi Ichikawa <http://gimite.net/en/>
			// License: New BSD License
			// Reference: http://dev.w3.org/html5/websockets/
			// Reference: http://tools.ietf.org/html/draft-hixie-thewebsocketprotocol
			// Full Sources codes provided in web_socket.js
	 		(function(){if(window.WebSocket)return;var console=window.console;if(!console|| !console.log|| !console.error){console={log:function(){},error:function(){}};}if(!swfobject.hasFlashPlayerVersion("10.0.0")){console.error("Flash Player >= 10.0.0 is required.");return;}if(location.protocol=="file:"){console.error("WARNING: web-socket-js doesn't work in file:///... URL "+"unless you set Flash Security Settings properly. "+"Open the page via Web server i.e. http://...");}WebSocket=function(url,protocol,proxyHost,proxyPort,headers){var self=this;self.__id=WebSocket.__nextId++;WebSocket.__instances[self.__id]=self;self.readyState=WebSocket.CONNECTING;self.bufferedAmount=0;self.__events={};setTimeout(function(){WebSocket.__addTask(function(){WebSocket.__flash.create(self.__id,url,protocol,proxyHost||null,proxyPort||0,headers||null);});},0);};WebSocket.prototype.send=function(data){if(this.readyState==WebSocket.CONNECTING){throw "INVALID_STATE_ERR: Web Socket connection has not been established";}var result=WebSocket.__flash.send(this.__id,encodeURIComponent(data));if(result<0){return true;}else{this.bufferedAmount+=result;return false;}};WebSocket.prototype.close=function(){if(this.readyState==WebSocket.CLOSED||this.readyState==WebSocket.CLOSING){return;}this.readyState=WebSocket.CLOSING;WebSocket.__flash.close(this.__id);};WebSocket.prototype.addEventListener=function(type,listener,useCapture){if(!(type in this.__events)){this.__events[type]=[];}this.__events[type].push(listener);};WebSocket.prototype.removeEventListener=function(type,listener,useCapture){if(!(type in this.__events))return;var events=this.__events[type];for(var i=events.length-1;i>=0;--i){if(events[i]===listener){events.splice(i,1);break;}}};WebSocket.prototype.dispatchEvent=function(event){var events=this.__events[event.type]||[];for(var i=0;i<events.length;++i){events[i](event);}var handler=this["on"+event.type];if(handler)handler(event);};WebSocket.prototype.__handleEvent=function(flashEvent){if("readyState"in flashEvent){this.readyState=flashEvent.readyState;}var jsEvent;if(flashEvent.type=="open"||flashEvent.type=="error"){jsEvent=this.__createSimpleEvent(flashEvent.type);}else if(flashEvent.type=="close"){jsEvent=this.__createSimpleEvent("close");}else if(flashEvent.type=="message"){var data=decodeURIComponent(flashEvent.message);jsEvent=this.__createMessageEvent("message",data);}else{throw "unknown event type: "+flashEvent.type;}this.dispatchEvent(jsEvent);};WebSocket.prototype.__createSimpleEvent=function(type){if(document.createEvent&&window.Event){var event=document.createEvent("Event");event.initEvent(type,false,false);return event;}else{return{type:type,bubbles:false,cancelable:false};}};WebSocket.prototype.__createMessageEvent=function(type,data){if(document.createEvent&&window.MessageEvent&& !window.opera){var event=document.createEvent("MessageEvent");event.initMessageEvent("message",false,false,data,null,null,window,null);return event;}else{return{type:type,data:data,bubbles:false,cancelable:false};}};WebSocket.CONNECTING=0;WebSocket.OPEN=1;WebSocket.CLOSING=2;WebSocket.CLOSED=3;WebSocket.__flash=null;WebSocket.__instances={};WebSocket.__tasks=[];WebSocket.__nextId=0;WebSocket.loadFlashPolicyFile=function(url){WebSocket.__addTask(function(){WebSocket.__flash.loadManualPolicyFile(url);});};WebSocket.__initialize=function(){if(WebSocket.__flash)return;if(WebSocket.__swfLocation){window.WEB_SOCKET_SWF_LOCATION=WebSocket.__swfLocation;}if(!window.WEB_SOCKET_SWF_LOCATION){console.error("[WebSocket] set WEB_SOCKET_SWF_LOCATION to location of WebSocketMain.swf");return;}var container=document.createElement("div");container.id="webSocketContainer";container.style.position="absolute";if(WebSocket.__isFlashLite()){container.style.left="0px";container.style.top="0px";}else{container.style.left="-100px";container.style.top="-100px";}var holder=document.createElement("div");holder.id="webSocketFlash";container.appendChild(holder);document.body.appendChild(container);swfobject.embedSWF(WEB_SOCKET_SWF_LOCATION,"webSocketFlash","1","1","10.0.0",null,null,{hasPriority:true,swliveconnect:true,allowScriptAccess:"always"},null,function(e){if(!e.success){console.error("[WebSocket] swfobject.embedSWF failed");}});};WebSocket.__onFlashInitialized=function(){setTimeout(function(){WebSocket.__flash=document.getElementById("webSocketFlash");WebSocket.__flash.setCallerUrl(location.href);WebSocket.__flash.setDebug(! !window.WEB_SOCKET_DEBUG);for(var i=0;i<WebSocket.__tasks.length;++i){WebSocket.__tasks[i]();}WebSocket.__tasks=[];},0);};WebSocket.__onFlashEvent=function(){setTimeout(function(){try{var events=WebSocket.__flash.receiveEvents();for(var i=0;i<events.length;++i){WebSocket.__instances[events[i].webSocketId].__handleEvent(events[i]);}}catch(e){console.error(e);}},0);return true;};WebSocket.__log=function(message){console.log(decodeURIComponent(message));};WebSocket.__error=function(message){console.error(decodeURIComponent(message));};WebSocket.__addTask=function(task){if(WebSocket.__flash){task();}else{WebSocket.__tasks.push(task);}};WebSocket.__isFlashLite=function(){if(!window.navigator|| !window.navigator.mimeTypes){return false;}var mimeType=window.navigator.mimeTypes["application/x-shockwave-flash"];if(!mimeType|| !mimeType.enabledPlugin|| !mimeType.enabledPlugin.filename){return false;}return mimeType.enabledPlugin.filename.match(/flashlite/i)?true:false;};if(!window.WEB_SOCKET_DISABLE_AUTO_INITIALIZATION){if(window.addEventListener){window.addEventListener("load",function(){WebSocket.__initialize();},false);}else{window.attachEvent("onload",function(){WebSocket.__initialize();});}}})();
			//	</JasobNoObfs>
		}

	} else {
		// no Flash Player installed
		WebSocket = null;
	}
}


jws.XHR = {
	//:i:en:AJAX constants

	//:const:*:XHR_ASYNC
	//:d:de:Asynchrone Kommunikation mit dem Server verwenden. Laufender Prozess wird fortgesetzt.
	//:d:en:Use asynchronous communication with the server. The current process is continued.
	ASYNC: true,
	//:const:*:SYNC
	//:d:de:Synchrone Kommunikation mit dem Server verwenden. Laufender Prozess wird geblockt.
	//:d:en:Use synchronous communication with the server. The current process is blocked.
	SYNC: false,

	METHOD_GET: "get",
	METHOD_POST: "post",
	METHOD_HEAD: "head",

	getXHRInstance: function() {
		var lXHR = null;

		//:i:de:Firefox, Opera, Safari etc. verf&uuml;gen &uuml;ber ein XMLHttpRequest Objekt
		if ( window.XMLHttpRequest ) {
			lXHR = new XMLHttpRequest();
		//:i:de:f&uuml;r den Internet Explorer muss ein ActiveX Objekt instantiiert werden.
		} else if( window.ActiveXObject ) {
			/*
 var XMLHTTP_IDS = new Array('MSXML2.XMLHTTP.5.0',
                                     'MSXML2.XMLHTTP.4.0',
                                     'MSXML2.XMLHTTP.3.0',
                                     'MSXML2.XMLHTTP',
                                     'Microsoft.XMLHTTP' );
          var success = false;
          for (var i=0;i < XMLHTTP_IDS.length && !success; i++) {
              try {
                   xmlhttp = new ActiveXObject(XMLHTTP_IDS[i]);
                      success = true;
                } catch (e) {}
          }
          if (!success) {
              throw new Error('Unable to create XMLHttpRequest.');
          }
*/
			try {
				lXHR = new ActiveXObject( "Msxml2.XMLHTTP" );
			} catch( e1 ) {
				try{
					lXHR = new ActiveXObject( "Microsoft.XMLHTTP" );
				} catch( e2 ) {
					//:todo:de:Exception handling implementieren falls kein AJAX Object geladen werden kann!
					throw "f3.cfw.std.ex.xhr.NotAvail";
				}
			}
		} else {
			throw "f3.cfw.std.ex.xhr.NotAvail";
		}
		return lXHR;
	},

	isProtocolOk: function( aContext ) {
		if( !aContext ) {
			aContext = self;
		}
		//:i:en:file protocol does not allow XHR requests.
		return(
			!(	aContext.location.protocol &&
				aContext.location.protocol.toLowerCase() == "file:"
				)
			);
	},

	//:i:de:Default AJAX handler, falls keine solchen von der Applikation bereit gestellt werden.
	//:i:en:default AJAX handler if no handler are provided by application
	mXHRSucClbk: function( aXHR, aArgs ) {
		throw "f3.cfw.std.ex.xhr.NoSuccObs";
	},

	mXHRErrClbk: function( aXHR, aArgs ) {
		throw "f3.cfw.std.ex.xhr.NoErrObs";
	},

	mXHRRespLsnr: function() {
		//:i:de:M&ouml;glicherweise kommt eine Antwort nachdem ein Fenster beendet wurde!
		var aOptions = arguments.callee.options;

		if( f3.ajax.Request !== undefined /* && f3.ajax.Request.mXHRStChgObs */ ) {

			if( aOptions.OnReadyStateChange ) {
				aOptions.OnReadyStateChange( aOptions.XHR, aOptions );
			}
			switch( aOptions.XHR.readyState ) {
				//:i:en:uninitialized
				case 0:
				//:i:en:loading
				case 1:
				//:i:en:loaded
				case 2:
				//:i:en:interactive
				case 3:
					break;
				//:i:en:complete
				case 4:
					clearTimeout( aOptions.hTimeout );
					if( aOptions.XHR.status == 200 ) {
						// aOptions.OnSuccess( aOptions.XHR, aOptions );
						f3.dom.Event.callObserver( aOptions.OnSuccess, aOptions.XHR, aOptions );
					} else	{
						// aOptions.OnError( aOptions.XHR, aOptions );
						f3.dom.Event.callObserver( aOptions.OnError, aOptions.XHR, aOptions );
					}
					aOptions.XHR = null;
					aOptions = null;
					arguments.callee.self = null;
					arguments.callee.options = null;
					// arguments.callee = null;
					break;
				default:
					aOptions.OnError( aOptions.XHR, aOptions );
					aOptions.XHR = null;
					aOptions = null;
					arguments.callee.self = null;
					arguments.callee.options = null;
					// arguments.callee = null;
					break;
			}
		}
	},

//	this.mXHRRespLsnr.options = aOptions;
//	this.mXHRRespLsnr.self = this;


	//:m:*:request
	//:d:de:Diese Methode f&uuml;hrt den eigentlichen XHR-Request aus.
	//:a:de::aURL:String:Server URL zu einer Datei (Ressource) oder einem Servlet oder einem anderen Dienst.
	//:a:de:aOptions:method:String:Entweder "post" (Daten&uuml;bermittlung im Post-Body) oder "get" (&uuml;bermittlung in der URL).
	//:a:de:aOptions:asynchronous:Boolean:Bestimmt ob die Anfrage asynchron (non-blocking) oder synchron (blocking) durchgef&uuml;hrt werden soll.
	//:a:de:aOptions:OnSuccess:Function:Callback der bei erfolgreicher Anfrage ausgef&uuml;hrt werden soll.
	//:a:de:aOptions:OnError:Function:Callback der bei fehlerhafter Anfrage ausgef&uuml;hrt werden soll.
	//:d:en:This method performs a AJAX call. The call either can be asynchronous or synchronous.
	//:a:en::aURL:String:Server URL to access a resource or servlet.
	//:a:en:aOptions:method:String:Can be "post" or "get".
	//:a:en:aOptions:asynchronous:Boolean:Perform the request asynchronously (non-blocking) oder synchronously (blocking).
	//:a:en:aOptions:OnSuccess:Function:Callback for a successful request.
	//:a:en:aOptions:OnError:Function:Callback for a erroneous request.
	//:r:*:::void
	request: function( aURL, aOptions ) {

		//i:de:Einige Vorgabewerte pr&uuml;fen...
		//i:en:Check some default values
		aOptions = f3.core.OOP.getDefaultOptions( aOptions, {
			method			: "POST",
			asynchronous	: f3.ajax.Common.ASYNC,
			postBody		: null,
			timeout			: -1,
			// username		: null,
			// password		: null,
			OnSuccess		: f3.ajax.Request.mXHRSucClbk,
			OnError			: f3.ajax.Request.mXHRErrClbk,
			contentType		: "text/plain; charset=UTF-8", // "application/x-www-form-urlencoded"
			cacheControl	: "must-revalidate"
		});

		//:i:de:Beim file Protokoll ist kein XHR m&ouml;glich.
		if( !f3.ajax.Common.isProtocolOk() ) {
			throw new Error( 0, f3.localeManager.getCurLocStr( "f3.cfw.std.ex.xhr.file" ) );
		}

		aOptions.XHR = f3.ajax.Common.getXHRInstance();
		if( aOptions.XHR ) {

			//:i:de:&Ouml;ffnen des XHR Objektes und...
			aOptions.XHR.open( aOptions.method, aURL, aOptions.asynchronous );

			//:i:de:Sobald ein Request offen ist, k&ouml;nnen wir den ContentType auf plain/text setzen.
			if ( aOptions.method.toLowerCase() == "post" ) {
				aOptions.XHR.setRequestHeader(
					"Content-type",
					aOptions.contentType
					);
			}

			if( aOptions.cacheControl )
				aOptions.XHR.setRequestHeader( "Cache-Control", aOptions.cacheControl );

			//:i:de:Eventhandler setzen (callback Funktion zuweisen)
			//:i:de:Dies funktioniert nicht f&uuml;r den Firefox im synchronen Modus, die Callback Funktion wird _
			//:i:de:nicht aufgerufen. Daher muss in diesem Fall der Handler nach dem "send" explizit _
			//:i:de:aufgerufen werden.

			var lResponseHandler = new $f3.$XHRResponse( aOptions );

			if( !f3.browser.Browser.isFirefox() || aOptions.asynchronous ) {
				aOptions.XHR.onreadystatechange = lResponseHandler.mXHRRespLsnr;
			// function() {
			//:i:de:M&ouml;glicherweise kommt eine Antwort nachdem ein Fenster beendet wurde!
			//	if( f3.ajax.Request !== undefined && f3.ajax.Request.mXHRStChgObs )
			//		f3.ajax.Request.mXHRStChgObs( aOptions );
			//};
			} else {
				aOptions.XHR.onreadystatechange = null;
			}

			if( aOptions.timeout > 0 ) {
				aOptions.hTimeout =
				setTimeout(
					function() {
						aOptions.XHR.abort();
						if( f3.browser.Browser.isFirefox() && !aOptions.asynchronous ) {
							lResponseHandler.handler( aOptions );
						}
					},
					aOptions.timeout
					);
			}

			//:i:de:...absetzen des Requests, bei GET-Requests ist postBody "null"
			try {
				aOptions.XHR.send( aOptions.postBody );
			} catch( e ) {
				aOptions.OnError( aOptions.XHR, aOptions );
			}
			//:i:de:Siehe oben bzgl. Firefox Work-Around
			if( f3.browser.Browser.isFirefox() && !aOptions.asynchronous ) {
				lResponseHandler.mXHRRespLsnr( aOptions );
			}
		// f3.ajax.Request.mXHRStChgObs( aOptions );
		}

		//:todo:de:Was passiert, wenn kein AJAX Object geladen werden konnte? Z.B. wegen Sicherheitseinstellungen... ?
		//:todo:de:Es k&ouml;nnte ein hilfreiches Ergebnis erzeugt werden, z.B. ob und wie der Request ausgef&uuml;hrt werden konnte.

		return aOptions.XHR;
	}

}


if( !jws.browserSupportsNativeJSON ) {
	// <JasobNoObfs>
	// Please refer to http://json.org/js
	if(!this.JSON){this.JSON={};}(function(){function f(n){return n<10?'0'+n:n;}if(typeof Date.prototype.toJSON!=='function'){Date.prototype.toJSON=function(key){return isFinite(this.valueOf())?this.getUTCFullYear()+'-'+f(this.getUTCMonth()+1)+'-'+f(this.getUTCDate())+'T'+f(this.getUTCHours())+':'+f(this.getUTCMinutes())+':'+f(this.getUTCSeconds())+'Z':null;};String.prototype.toJSON=Number.prototype.toJSON=Boolean.prototype.toJSON=function(key){return this.valueOf();};}var cx=/[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,escapable=/[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,gap,indent,meta={'\b':'\\b','\t':'\\t','\n':'\\n','\f':'\\f','\r':'\\r','"':'\\"','\\':'\\\\'},rep;function quote(string){escapable.lastIndex=0;return escapable.test(string)?'"'+string.replace(escapable,function(a){var c=meta[a];return typeof c==='string'?c:'\\u'+('0000'+a.charCodeAt(0).toString(16)).slice(-4);})+'"':'"'+string+'"';}function str(key,holder){var i,k,v,length,mind=gap,partial,value=holder[key];if(value&&typeof value==='object'&&typeof value.toJSON==='function'){value=value.toJSON(key);}if(typeof rep==='function'){value=rep.call(holder,key,value);}switch(typeof value){case'string':return quote(value);case'number':return isFinite(value)?String(value):'null';case'boolean':case'null':return String(value);case'object':if(!value){return'null';}gap+=indent;partial=[];if(Object.prototype.toString.apply(value)==='[object Array]'){length=value.length;for(i=0;i<length;i+=1){partial[i]=str(i,value)||'null';}v=partial.length===0?'[]':gap?'[\n'+gap+partial.join(',\n'+gap)+'\n'+mind+']':'['+partial.join(',')+']';gap=mind;return v;}if(rep&&typeof rep==='object'){length=rep.length;for(i=0;i<length;i+=1){k=rep[i];if(typeof k==='string'){v=str(k,value);if(v){partial.push(quote(k)+(gap?': ':':')+v);}}}}else{for(k in value){if(Object.hasOwnProperty.call(value,k)){v=str(k,value);if(v){partial.push(quote(k)+(gap?': ':':')+v);}}}}v=partial.length===0?'{}':gap?'{\n'+gap+partial.join(',\n'+gap)+'\n'+mind+'}':'{'+partial.join(',')+'}';gap=mind;return v;}}if(typeof JSON.stringify!=='function'){JSON.stringify=function(value,replacer,space){var i;gap='';indent='';if(typeof space==='number'){for(i=0;i<space;i+=1){indent+=' ';}}else if(typeof space==='string'){indent=space;}rep=replacer;if(replacer&&typeof replacer!=='function'&&(typeof replacer!=='object'||typeof replacer.length!=='number')){throw new Error('JSON.stringify');}return str('',{'':value});};}if(typeof JSON.parse!=='function'){JSON.parse=function(text,reviver){var j;function walk(holder,key){var k,v,value=holder[key];if(value&&typeof value==='object'){for(k in value){if(Object.hasOwnProperty.call(value,k)){v=walk(value,k);if(v!==undefined){value[k]=v;}else{delete value[k];}}}}return reviver.call(holder,key,value);}text=String(text);cx.lastIndex=0;if(cx.test(text)){text=text.replace(cx,function(a){return'\\u'+('0000'+a.charCodeAt(0).toString(16)).slice(-4);});}if(/^[\],:{}\s]*$/.test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,'@').replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,']').replace(/(?:^|:|,)(?:\s*\[)+/g,''))){j=eval('('+text+')');return typeof reviver==='function'?walk({'':j},''):j;}throw new SyntaxError('JSON.parse');};}}());
	// </JasobNoObfs>
}

//	<JasobNoObfs>
//	Base64 encode / decode
//  http://www.webtoolkit.info/
var Base64={_keyStr:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",encode:function(input){var output="";var chr1,chr2,chr3,enc1,enc2,enc3,enc4;var i=0;input=Base64._utf8_encode(input);while(i<input.length){chr1=input.charCodeAt(i++);chr2=input.charCodeAt(i++);chr3=input.charCodeAt(i++);enc1=chr1>>2;enc2=((chr1&3)<<4)|(chr2>>4);enc3=((chr2&15)<<2)|(chr3>>6);enc4=chr3&63;if(isNaN(chr2)){enc3=enc4=64;}else if(isNaN(chr3)){enc4=64;}output=output+this._keyStr.charAt(enc1)+this._keyStr.charAt(enc2)+this._keyStr.charAt(enc3)+this._keyStr.charAt(enc4);}return output;},decode:function(input){var output="";var chr1,chr2,chr3;var enc1,enc2,enc3,enc4;var i=0;input=input.replace(/[^A-Za-z0-9\+\/\=]/g,"");while(i<input.length){enc1=this._keyStr.indexOf(input.charAt(i++));enc2=this._keyStr.indexOf(input.charAt(i++));enc3=this._keyStr.indexOf(input.charAt(i++));enc4=this._keyStr.indexOf(input.charAt(i++));chr1=(enc1<<2)|(enc2>>4);chr2=((enc2&15)<<4)|(enc3>>2);chr3=((enc3&3)<<6)|enc4;output=output+String.fromCharCode(chr1);if(enc3!=64){output=output+String.fromCharCode(chr2);}if(enc4!=64){output=output+String.fromCharCode(chr3);}}output=Base64._utf8_decode(output);return output;},_utf8_encode:function(string){string=string.replace(/\r\n/g,"\n");var utftext="";for(var n=0;n<string.length;n++){var c=string.charCodeAt(n);if(c<128){utftext+=String.fromCharCode(c);}else if((c>127)&&(c<2048)){utftext+=String.fromCharCode((c>>6)|192);utftext+=String.fromCharCode((c&63)|128);}else{utftext+=String.fromCharCode((c>>12)|224);utftext+=String.fromCharCode(((c>>6)&63)|128);utftext+=String.fromCharCode((c&63)|128);}}return utftext;},_utf8_decode:function(utftext){var string="";var i=0;var c=c1=c2=0;while(i<utftext.length){c=utftext.charCodeAt(i);if(c<128){string+=String.fromCharCode(c);i++;}else if((c>191)&&(c<224)){c2=utftext.charCodeAt(i+1);string+=String.fromCharCode(((c&31)<<6)|(c2&63));i+=2;}else{c2=utftext.charCodeAt(i+1);c3=utftext.charCodeAt(i+2);string+=String.fromCharCode(((c&15)<<12)|((c2&63)<<6)|(c3&63));i+=3;}}return string;}}
//	</JasobNoObfs>


//	---------------------------------------------------------------------------
//  jWebSocket - some convenience JavaScript OOP tools
//	---------------------------------------------------------------------------
jws.oop = {};

// implement simple class declaration to support multi-level inheritance
// and easy 'inherited' calls (super-calls) in JavaScript
jws.oop.declareClass = function( aNamespace, aClassname, aAncestor, aFields ) {

	var lNS = self[ aNamespace ];
	if( !lNS ) {
		self[ aNamespace ] = {};
	}

	var lConstructor = function() {
		if( this.create ) {
			this.create.apply( this, arguments );
		}
	};

	// publish the new class in the given name space
	lNS[ aClassname ] = lConstructor;

	// move all fields from spec to new class' prototype
	var lField;
	for( lField in aFields ) {
		lConstructor.prototype[ lField ] = aFields[ lField ];
	}
	if( aAncestor != null ) {
		// every class maintains an array of its direct descendants
		if( !aAncestor.descendants ) {
			aAncestor.descendants = [];
		}
		aAncestor.descendants.push( lConstructor );
		for( lField in aAncestor.prototype ) {
			var lAncMthd = aAncestor.prototype[ lField ];
			if( typeof lAncMthd == "function" ) {
				if( lConstructor.prototype[ lField ] ) {
					lConstructor.prototype[ lField ].inherited = lAncMthd;
				} else {
					lConstructor.prototype[ lField ] = lAncMthd;
				}
				// every method gets a reference to its super class
				// to allow class to inherited method from such
				lConstructor.prototype[ lField ].superClass = aAncestor;
			}
		}
	}
};


// plug-in functionality to allow to add plug-ins into existing classes
jws.oop.addPlugIn = function( aClass, aPlugIn ) {

	// if the class has no plug-ins yet initialize array
	if( !aClass.fPlugIns ) {
		aClass.fPlugIns = [];
	}
	// add the plug-in to the class
	aClass.fPlugIns.push( aPlugIn );
	// clone all methods of the plug-in to the class
	for( var lField in aPlugIn ) {
		// don't overwrite existing methods of class with plug-in methods
		// ensure that native jWebSocket methods don't get overwritten!
		if( !aClass.prototype[ lField ] ) {
			aClass.prototype[ lField ] = aPlugIn[ lField ];
			// var lObj = aClass.prototype[ lField ];
		}
	}
	// if the class already has descendants recursively
	// clone the plug-in methods to these as well.
	if( aClass.descendants ) {
		for( var lIdx = 0, lCnt = aClass.descendants.length; lIdx < lCnt; lIdx ++ ) {
			jws.oop.addPlugIn( aClass.descendants[ lIdx ], aPlugIn );
		}
	}
};


//	---------------------------------------------------------------------------
//  jWebSocket - Base Client
//  This class does not handle exceptions or error, it throws exceptions,
//  which are handled by the descendant classes.
//	---------------------------------------------------------------------------

//:package:*:jws
//:class:*:jws.jWebSocketBaseClient
//:ancestor:*:-
//:d:en:Implementation of the [tt]jws.jWebSocketBaseClient[/tt] class. _
//:d:en:This class does not handle exceptions or error, it throws exceptions, _
//:d:en:which are (have to be) handled by the descendant classes.

jws.oop.declareClass( "jws", "jWebSocketBaseClient", null, {

	create: function( aOptions ) {
		// turn off connection reliability by default
		if( !this.fReliabilityOptions ) {
			this.fReliabilityOptions = jws.RO_OFF;
		}
	},

	//:m:*:processOpened
	//:d:en:Called when the WebSocket connection successfully was established. _
	//:d:en:Can to be overwritten in descendant classes to process _
	//:d:en:[tt]onopen[/tt] event in descendant classes.
	//:a:en::aEvent:Object:Pending...
	//:r:*:::void:none
	processOpened: function( aEvent ) {
		// method to be overwritten in descendant classes
	},

	//:m:*:processPacket
	//:d:en:Called when a data packet was received. _
	//:d:en:Can to be overwritten in descendant classes to process _
	//:d:en:[tt]onmessage[/tt] event in descendant classes.
	//:a:en::aEvent:Object:Pending...
	//:r:*:::void:none
	processPacket: function( aEvent ) {
		// method to be overwritten in descendant classes
	},

	//:m:*:processClosed
	//:d:en:Called when the WebSocket connection was closed. _
	//:d:en:Can to be overwritten in descendant classes to process _
	//:d:en:[tt]onclose[/tt] event in descendant classes.
	//:a:en::aEvent:Object:Pending...
	//:r:*:::void:none
	processClosed: function( aEvent ) {
		// method to be overwritten in descendant classes
	},

	//:m:*:open
	//:d:en:Tries to establish a connection the jWebSocket server.
	//:a:en::aURL:String:URL to the jWebSocket Server
	//:a:en::aOptions:Object:Optional arguments, see below...
	//:a:en:aOptions:OnOpen:function:Callback when connection was successfully established.
	//:r:*:::void:none
	open: function( aURL, aOptions ) {
		if( !aOptions ) {
			aOptions = {};
		}
		// if browser natively supports WebSockets...
		// otherwise flash bridge may have embedded WebSocket class
		if( self.WebSocket ) {

			// TODO: !this.fConn is not enough here! Check for readystate!
			// if connection not already established...
			if( !this.fConn ) {
				var lThis = this;
				var lValue = null;

				// check if subprotocol is given
				// if not use JSON as default
				var lSubProt = jws.WS_SUBPROT_JSON;
				if( aOptions.subProtocol ) {
					lSubProt = aOptions.subProtocol;
				}
				// check if connection reliability is desired
				if( aOptions.reliabilityOptions ) {
					this.fReliabilityOptions = aOptions.reliabilityOptions;
				}
				// turn off isExplicitClose flag
				// to allow optional reconnect
				if( this.fReliabilityOptions ) {
					this.fReliabilityOptions.isExplicitClose = false;
				}

				// maintain own status flag
				if( this.fStatus != jws.RECONNECTING ) {
					this.fStatus = jws.CONNECTING;
				}
				// create a new web socket instance
				this.fConn = new WebSocket( aURL, lSubProt );
				// save URL and sub prot for optional re-connect
				this.fURL = aURL;
				this.fSubProt = lSubProt;

				// assign the listeners to local functions (closure) to allow
				// to handle event before and after the application
				this.fConn.onopen = function( aEvent ) {
					lThis.fStatus = jws.OPEN;
					lValue = lThis.processOpened( aEvent );
					// give application change to handle event
					if( aOptions.OnOpen ) {
						aOptions.OnOpen( aEvent, lValue, lThis );
					}
					// process outgoing queue
					lThis.processQueue();
				};

				this.fConn.onmessage = function( aEvent ) {
					lValue = lThis.processPacket( aEvent );
					// give application change to handle event first
					if( aOptions.OnMessage ) {
						aOptions.OnMessage( aEvent, lValue, lThis );
					}
				};

				this.fConn.onclose = function( aEvent ) {
					lThis.fStatus = jws.CLOSED;
					// check if still disconnect timeout active and clear if needed
					if( lThis.hDisconnectTimeout ) {
						clearTimeout( lThis.hDisconnectTimeout );
						delete lThis.hDisconnectTimeout;
					}
					lValue = lThis.processClosed( aEvent );
					// give application chance to handle event
					if( aOptions.OnClose ) {
						aOptions.OnClose( aEvent, lValue, lThis );
					}
					lThis.fConn = null;

					// connection was closed,
					// check if auto-reconnect was configured
					if( lThis.fReliabilityOptions
						&& lThis.fReliabilityOptions.autoReconnect
						&& !lThis.fReliabilityOptions.isExplicitClose ) {

						lThis.fStatus = jws.RECONNECTING;

						lThis.hReconnectDelayTimeout = setTimeout(
							function() {
								if( aOptions.OnReconnecting ) {
									aOptions.OnReconnecting( aEvent, lValue, lThis );
								}
								lThis.open( lThis.fURL, aOptions );
							},
							lThis.fReliabilityOptions.reconnectDelay
						);
					}
				};

			} else {
				throw new Error( "Already connected" );
			}
		} else {
			throw new Error( "WebSockets not supported by browser" );
		}
	},

	//:m:*:connect
	//:a:en::aURL:String:Please refer to [tt]open[/tt] method.
	//:a:en::aOptions:Object:Please refer to [tt]open[/tt] method.
	//:r:*:::void:none
	connect: function( aURL, aOptions ) {
		return this.open(aURL, aOptions );
	},

	//:m:*:processQueue
	//:d:en:Processes the token queue. _
	//:d:en:Tries to send out all tokens stored in the quere
	//:a:en::::-
	//:r:*:::void:none
	processQueue: function() {
		// is there a queue at all?
		if( this.fOutQueue ) {
			var lRes = this.checkConnected();
			if( lRes.code == 0 ) {
				var lItem;
				while( this.fOutQueue.length > 0 ) {
					// get first element of the queue
					lItem = this.fOutQueue.shift();
					// and send it to the server
					this.fConn.send( lItem.packet );
				}
			}
		}
		// if no queue exists nothing needs to be done here.
	},

	//:m:*:queuePacket
	//:d:en:Adds a new token to the send queue
	//:d:en:this method can also be executed, if no connection is established
	//:a:en::aToken:Object:Token to be queued to the jWebSocket server.
	//:a:en::aOptions:Object:Optional arguments as listed below...
	//:a:en:aOptions:OnResponse:Function:Reference to callback function, which is called when the response is received.
	//:r:*:::void:none
	queuePacket: function( aPacket, aOptions ) {
		if( !this.fOutQueue ) {
			this.fOutQueue = [];
		}
		this.fOutQueue.push({
			packet: aPacket,
			options: aOptions
		});
	},

	//:m:*:sendStream
	//:d:en:Sends a given string to the jWebSocket Server. The methods checks _
	//:d:en:if the connection is still up and throws an exception if not.
	//:a:en::aData:String:String to be send the jWebSocketServer
	//:r:*:::void:none
	sendStream: function( aData ) {
		// is client already connected
		if( this.isOpened() ) {
			try {
				this.fConn.send( aData );
			} catch( lEx ) {
				// this is never fired !
				// console.log( "Could not send!" );
			}
		} else {
			if( this.isWriteable() ) {
				this.queuePacket( aData, null );
			} else {
				// if not raise exception
				throw new Error( "Not connected" );
			}
		}
	},

	//:m:*:abortReconnect
	//:d:en:Aborts a pending automatic re-connection, if such.
	//:a:en::::none
	//:r:*:::boolean:[tt]true[/tt], if re-connect was pending, [tt]false[/tt] if nothing to abort.
	abortReconnect: function() {
		// in case connection could be established
		// reset the re-connect interval.
		if( this.hReconnectDelayTimeout ) {
			clearTimeout( this.hReconnectDelayTimeout );
			this.hReconnectDelayTimeout = null;
			return true;
		}
		return false;
	},

	//:m:*:setAutoReconnect
	//:d:en:Specifies whether to automatically re-connect in case of _
	//:d:en:connection loss.
	//:a:en::aAutoReconnect:Boolean:[tt]true[/tt] if auto-reconnect is desired, otherwise [tt]false[/tt].
	//:r:*:::void:none
	setAutoReconnect: function( aAutoReconnect ) {
		if( aAutoReconnect && typeof( aLimit ) == "boolean" ) {
			this.fReliabilityOptions.autoReconnect = aAutoReconnect;
		} else {
			this.fReliabilityOptions.autoReconnect = false;
		}
		// if no auto-reconnect is desired, abort a pending re-connect, if such.
		if( !( this.fReliabilityOptions && this.fReliabilityOptions.autoReconnect ) ) {
			abortReconnect();
		}
	},

	//:m:*:setQueueItemLimit
	//:d:en:Specifies the maximum number of allowed queue items. If a zero or _
	//:d:en:negative number is passed the number of items is not checked. _
	//:d:en:If the limit is exceeded the OnBufferOverflow event is fired.
	//:a:en::aLimit:Integer:Maximum of allowed messages in the queue.
	//:r:*:::void:none
	setQueueItemLimit: function( aLimit ) {
		if( aLimit && typeof( aLimit ) == "number" && aLimit > 0 ) {
			this.fReliabilityOptions.queueItemLimit = parseInt( aLimit );
		} else {
			this.fReliabilityOptions.queueItemLimit = 0;
		}
	},

	//:m:*:setQueueSizeLimit
	//:d:en:Specifies the maximum size in bytes allowed for the queue. If a zero or _
	//:d:en:negative number is passed the size of the queue is not checked. _
	//:d:en:If the limit is exceeded the OnBufferOverflow event is fired.
	//:a:en::aLimit:Integer:Maximum size of the queue in bytes.
	//:r:*:::void:none
	setQueueSizeLimit: function( aLimit ) {
		if( aLimit && typeof( aLimit ) == "number" && aLimit > 0 ) {
			this.fReliabilityOptions.queueSizeLimit = parseInt( aLimit );
		} else {
			this.fReliabilityOptions.queueSizeLimit = 0;
		}
	},

	//:m:*:setReliabilityOptions
	//:d:en:Specifies how the connection is management (null = no management) is done.
	//:a:en::aOptions:Object:The various connection management options.
	//:r:*:::void:none
	setReliabilityOptions: function( aOptions ) {
		this.fReliabilityOptions = aOptions;
		// if no auto-reconnect is desired, abort a pending re-connect, if such.
		// if no auto-reconnect is desired, abort a pending re-connect, if such.
		if( this.fReliabilityOptions ) {
			if( this.fReliabilityOptions.autoReconnect ) {
				//:todo:en:here we could think about establishing the connection
				// but this would required to pass all args for open!
			} else {
				abortReconnect();
			}
		}
	},

	//:m:*:getReliabilityOptions
	//:d:en:Returns how the connection is management (null = no management) is done.
	//:a:en::aOptions:Object:The various connection management options.
	//:r:*:::void:none
	getReliabilityOptions: function() {
		return this.fReliabilityOptions;
	},

	//:m:*:getOutQueue
	//:d:en:Returns the outgoing message queue.
	//:a:en::::none
	//:r:*:::Array:The outgoing message queue, if such, otherwise [tt]undefined[/tt] or [tt]null[/tt].
	getOutQueue: function() {
		return this.fOutQueue;
	},

	//:m:*:resetSendQueue
	//:d:en:resets the send queue by simply deleting the queue field _
	//:d:en:of the connection.
	//:a:en::::none
	//:r:*:::void:none
	resetSendQueue: function() {
		delete this.fOutQueue;
	},

	//:m:*:isOpened
	//:d:en:Returns [tt]true[/tt] if the WebSocket connection opened up, otherwise [tt]false[/tt].
	//:a:en::::none
	//:r:*:::boolean:[tt]true[/tt] if the WebSocket connection is up otherwise [tt]false[/tt].
	isOpened: function() {
		return(
			this.fConn != undefined
			&& this.fConn != null
			&& this.fConn.readyState == jws.OPEN
		);
	},

	//:m:*:getURL
	//:d:en:Returns the URL if the WebSocket connection opened up, otherwise [tt]null[/tt].
	//:a:en::::none
	//:r:*:::String:the URL if the WebSocket connection opened up, otherwise [tt]null[/tt].
	getURL: function() {
		return this.fURL;
		/*
		return(
			this.fConn != undefined
			&& this.fConn != null
			&& this.fConn.readyState == jws.OPEN
			? this.fURL
			: null
		);
		*/
	},

	//:m:*:getSubProt
	//:d:en:Returns the selected sub protocol when the WebSocket connection
	//:d:en:was opened, otherwise [tt]null[/tt].
	//:a:en::::none
	//:r:*:::String:the URL if the WebSocket connection opened up, otherwise [tt]null[/tt].
	getSubProt: function() {
		return this.fSubProt;
	},

	//:m:*:isConnected
	//:@deprecated:en:Use [tt]isOpened()[/tt] instead.
	//:d:en:Returns [tt]true[/tt] if the WebSocket connection is up otherwise [tt]false[/tt].
	//:a:en::::none
	//:r:*:::boolean:[tt]true[/tt] if the WebSocket connection is up otherwise [tt]false[/tt].
	isConnected: function() {
		return( this.isOpened() );
	},

	//:m:*:forceClose
	//:d:en:Forces an immediate client side disconnect. The processClosed
	//:d:en:method is called if the connection was up otherwise no operation is
	//:d:en:performed.
	//:a:en::::none
	//:r:*:::void:none
	forceClose: function( aOptions ) {
		// if client closes usually no event is fired
		// here you optionally can fire it if required in your app!
		var lFireClose = false;
		// turn on isExplicitClose flag to not auto re-connect in case
		// of an explicit, i.e. desired client side close operation
		if( this.fReliabilityOptions ) {
			this.fReliabilityOptions.isExplicitClose = true;
		}
		if( aOptions ) {
			if( aOptions.fireClose && this.fConn.onclose ) {
				// TODO: Adjust to event fields
				// if such are delivered in real event
				var lEvent = {};
				this.fConn.onclose( lEvent );
			}
		}
		if( this.fConn ) {
			// if( window.console ) { console.log( "forcing close...." ); }
			// reset listeners to prevent any kind of potential memory leaks.
			this.fConn.onopen = null;
			this.fConn.onmessage = null;
			this.fConn.onclose = null;
			// TODO: what about CONNECTING state ?!
			if( this.fConn.readyState == jws.OPEN ) {
				this.fConn.close();
			}
			// TODO: should be called only if client was really opened before
			this.processClosed();
		}
		// explicitely reset fConn to "null"
		this.fConn = null;
	},

	//:m:*:close
	//:d:en:Closes the connection either immediately or with an optional _
	//:d:en:timeout. _
	//:d:en:If the connection is established up an exception s fired.
	//:a:en::aOptions:Object:Optional arguments as listed below...
	//:a:en:aOptions:timeout:Number:The close timeout in milliseconds, default [tt]0[/tt].
	//:r:*:::void:none
	close: function( aOptions ) {
		// check if timeout option is used
		var lTimeout = 0;

		if( aOptions ) {
			if( aOptions.timeout ) {
				lTimeout = aOptions.timeout;
			}
		}
		// connection established at all?
		// TODO: Shouldn't we test for ready state here?
		if( this.fConn ) {
			if( lTimeout <= 0 ) {
				this.forceClose( aOptions );
			} else {
				var lThis = this;
				this.hDisconnectTimeout = setTimeout(
					function() {
						lThis.forceClose( aOptions );
					},
					lTimeout
				);
			}
		// throw exception if not connected
		} else {
			this.fConn = null;
			throw new Error( "Not connected" );
		}
	},

	//:m:*:disconnect
	//:d:en:Deprecated, kept for upward compatibility only. Do not use anymore! _
	//:d:en:Please refer to the [tt]close[/tt] method.
	//:a:en::aOptions:Object:Please refer to the [tt]close[/tt] method.
	//:r:*::::Please refer to the [tt]close[/tt] method.
	disconnect: function( aOptions ) {
		return this.close( aOptions );
	},

	addListener: function( aCallback ) {
		// if the class has no plug-ins yet initialize array
		if( !this.fListeners ) {
			this.fListeners = [];
		}
		this.fListeners.push( aCallback );
	},

	removeListener: function( aCallback ) {
		if( this.fListeners ) {
			for( var lIdx = 0, lCnt = this.fListeners; lIdx < lCnt; lIdx++ ) {
				if( aCallback == this.fListeners[ lIdx ] ) {
					this.fListeners.splice( lIdx, 1 );
				}
			}
		}
	},

	//:m:*:addPlugIn
	//:d:en:Adds a client side plug-in to the instance - not to the class!
	//:a:en::aPlugIn:Object:Plug-in to be appended to the client side plug-in chain.
	//:r:*:::void:none
	addPlugIn: function( aPlugIn, aId ) {
		// if the class has no plug-ins yet initialize array
		if( !this.fPlugIns ) {
			this.fPlugIns = [];
		}
		// add the plug-in to the class
		this.fPlugIns.push( aPlugIn );
/*
 		 var lField;
 */
		if( !aId ) {
			aId = aPlugIn.ID;
		}
		//:todo:en:check if plug-in with given id already exists!
		if( aId ) {
			aPlugIn.conn = this;
/*
			// blend all methods of the plug-in to the connection instance
			this[ aId ] = {
				conn: this
			};
			for( lField in aPlugIn ) {
				if( lField != "conn" ) {
					this[ aId ][ lField ] = aPlugIn[ lField ];
				}
			}
*/
		}
	}

});


//	---------------------------------------------------------------------------
//  jWebSocket token client (this is an abstract class)
//  don't create direct instances of jWebSocketTokenClient
//	---------------------------------------------------------------------------

//:package:*:jws
//:class:*:jws.jWebSocketTokenClient
//:ancestor:*:jws.jWebSocketBaseClient
//:d:en:Implementation of the [tt]jWebSocketTokenClient[/tt] class. This is _
//:d:en:an abstract class as an ancestor for the JSON-, CSV- and XML client. _
//:d:en:Do not create direct instances of jWebSocketTokenClient.
jws.oop.declareClass( "jws", "jWebSocketTokenClient", jws.jWebSocketBaseClient, {

	//:m:*:create
	//:d:en:This method is called by the contructor of this class _
	//:d:en:to init the instance.
	//:a:en::::none
	//:r:*:::void:none
	create: function( aOptions ) {
		// call inherited create
		arguments.callee.inherited.call( this, aOptions );
		this.fRequestCallbacks = {};
	},

	//:m:*:getId
	//:d:en:Returns the unique id of this client assigned by the jWebSocket server.
	//:a:en::::none
	//:r:*:::String:Unique id of this client.
	getId: function() {
		return this.fClientId;
	},

	//:m:*:checkCallbacks
	//:d:en:Processes an incoming result token and assigns it to a previous _
	//:d:en:request. If a request was found it calls it OnResponse method _
	//:d:en:and removes the reference of the list of pending results.
	//:d:en:This method is used internally only and should not be called by _
	//:d:en:the application.
	//:a:en::aToken:Object:The incoming result token.
	//:r:*:::void:none
	checkCallbacks: function( aToken ) {
		var lField = "utid" + aToken.utid;
		// console.log( "checking result for utid: " + aToken.utid + "..." );
		var lClbkRec = this.fRequestCallbacks[ lField ];
		if( lClbkRec ) {
			// result came in within the given timeout
			// first cleanup timeout observer because
			// OnResponse listener potentially could take a while as well
			if( lClbkRec.hCleanUp ) {
				// thus reset the timeout observer
				clearTimeout( lClbkRec.hCleanUp );
			}
			var lArgs = lClbkRec.args;
			lClbkRec.callback.OnResponse( aToken, lArgs );
			delete this.fRequestCallbacks[ lField ];
		}
	},

	//:m:*:createDefaultResult
	//:d:en:Creates a response token with [tt]code = 0[/tt] and _
	//:d:en:[tt]msg = "Ok"[/tt]. It automatically increases the TOKEN_ID _
	//:d:en:to obtain a unique serial id for the next request.
	//:a:en::::none
	//:r:*:::void:none
	createDefaultResult: function() {
		return{
			code: 0,
			msg: "Ok",
			localeKey: "jws.jsc.res.Ok",
			args: null,
			tid: jws.CUR_TOKEN_ID
		};
	},

	//:m:*:checkConnected
	//:d:en:Checks if the client is connected and if so returns a default _
	//:d:en:response token (please refer to [tt]createDefaultResult[/tt] _
	//:d:en:method. If the client is not connected an error token is returned _
	//:d:en:with [tt]code = -1[/tt] and [tt]msg = "Not connected"[/tt]. _
	//:d:en:This is a convenience method if a function needs to check if _
	//:d:en:the client is connected and return an error token if not.
	//:a:en::::none
	//:r:*:::void:none
	checkConnected: function() {
		var lRes = this.createDefaultResult();
		if( !this.isOpened() ) {
			lRes.code = -1;
			lRes.localeKey = "jws.jsc.res.notConnected";
			lRes.msg = "Not connected.";
		}
		return lRes;
	},

	//:m:*:isWriteable
	//:d:en:Checks if the client currently is able to process send commands. _
	//:d:en:In case the connection-reliability option in turned on the _
	//:d:en:write queue is used to buffer outgoing packets. The queue may be _
	//:d:en:in number of items as as well as in size and time.
	//:a:en::::none
	//:r:*:::void:none
	isWriteable: function() {
		return(
			this.isOpened() || this.fStatus == jws.RECONNECTING
		);
	},

	//:m:*:checkWriteable
	//:d:en:Checks if the client is connected and if so returns a default _
	//:d:en:response token (please refer to [tt]createDefaultResult[/tt] _
	//:d:en:method. If the client is not connected an error token is returned _
	//:d:en:with [tt]code = -1[/tt] and [tt]msg = "Not connected"[/tt]. _
	//:d:en:This is a convenience method if a function needs to check if _
	//:d:en:the client is connected and return an error token if not.
	//:a:en::::none
	//:r:*:::void:none
	checkWriteable: function() {
		var lRes = this.createDefaultResult();
		if( !this.isWriteable() ) {
			lRes.code = -1;
			lRes.localeKey = "jws.jsc.res.notWriteable";
			lRes.msg = "Not writable.";
		}
		return lRes;
	},

	//:m:*:checkLoggedIn
	//:d:en:Checks if the client is connected and logged in and if so returns _
	//:d:en:a default response token (please refer to [tt]createDefaultResult[/tt] _
	//:d:en:method. If the client is not connected or nott logged in an error _
	//:d:en:token is returned with [tt]code = -1[/tt] and _
	//:d:en:[tt]msg = "Not logged in"[/tt]. _
	//:d:en:This is a convenience method if a function needs to check if _
	//:d:en:the client is connected and return an error token if not.
	//:a:en::::none
	//:r:*:::void:none
	checkLoggedIn: function() {
		var lRes = this.checkConnected();
		if( lRes.code == 0 && !this.isLoggedIn() ) {
			lRes.code = -1;
			lRes.localeKey = "jws.jsc.res.notLoggedIn";
			lRes.msg = "Not logged in.";
		}
		return lRes;
	},

	//:m:*:resultToString
	//:d:en:Converts a result token to a readable string e.g. to be displayed _
	//:d:en:in the GUI.
	//:a:en::aResToken:Object:The result token to be converted into a string.
	//:r:*:::String:The human readable string output of the result token.
	resultToString: function( aResToken ) {
		return(
			( aResToken && typeof aResToken == "object" && aResToken.msg ?
				aResToken.msg : "invalid response token" )
			// + " (code: " + aRes.code + ", tid: " + aRes.tid + ")"
		);
	},

	//:m:*:tokenToStream
	//:d:en:Converts a token into a string (stream). This method needs to be _
	//:d:en:overwritten by the descendant classes to implement a certain _
	//:d:en:sub protocol like JSON, CSV or XML. If you call this method _
	//:d:en:directly an exception is raised.
	//:a:en::aToken:Object:Token to be converted into a stream.
	//:r:*:::void:none
	tokenToStream: function( aToken ) {
		// this is supposed to convert a token into a string stream which is
		// send to the server, not implemented in base class.
		// needs to be overwritten in descendant classes!
		throw new Error( "tokenToStream needs to be overwritten in descendant classes" );
	},

	//:m:*:streamToToken
	//:d:en:Converts a string (stream) into a token. This method needs to be _
	//:d:en:overwritten by the descendant classes to implement a certain _
	//:d:en:sub protocol like JSON, CSV or XML. If you call this method _
	//:d:en:directly an exception is raised.
	//:a:en::aStream:String:Stream to be converted into a token.
	//:r:*:::void:none
	streamToToken: function( aStream ) {
		// this is supposed to convert a string stream from the server into
		// a token (object), not implemented in base class.
		// needs to be overwritten in descendant classes
		throw new Error( "streamToToken needs to be overwritten in descendant classes" );
	},

	//:m:*:notifyPlugInsOpened
	//:d:en:Iterates through the client side plug-in chain and calls the _
	//:d:en:[tt]processOpened[/tt] method of each plug-in after the client _
	//:d:en:successfully established the connection to the server.
	//:d:en:By this mechanism all plug-ins easily can handle a new connection.
	//:a:en::::none
	//:r:*:::void:none
	notifyPlugInsOpened: function() {
		var lToken = {
			sourceId: this.fClientId
		};
		// notify all plug-ins about sconnect event
		var lPlugIns = jws.jWebSocketTokenClient.fPlugIns;
		if( lPlugIns ) {
			for( var lIdx = 0, lLen = lPlugIns.length; lIdx < lLen; lIdx++ ) {
				var lPlugIn = lPlugIns[ lIdx ];
				if( lPlugIn.processOpened ) {
					lPlugIn.processOpened.call( this, lToken );
				}
			}
		}
	},

	//:m:*:notifyPlugInsClosed
	//:d:en:Iterates through the client side plug-in chain and calls the _
	//:d:en:[tt]processClosed[/tt] method of each plug-in after the client _
	//:d:en:successfully established the connection to the server.
	//:d:en:By this mechanism all plug-ins easily can handle a terminated connection.
	//:a:en::::none
	//:r:*:::void:none
	notifyPlugInsClosed: function() {
		var lToken = {
			sourceId: this.fClientId
		};
		// notify all plug-ins about disconnect event
		var lPlugIns = jws.jWebSocketTokenClient.fPlugIns;
		if( lPlugIns ) {
			for( var lIdx = 0, lLen = lPlugIns.length; lIdx < lLen; lIdx++ ) {
				var lPlugIn = lPlugIns[ lIdx ];
				if( lPlugIn.processClosed ) {
					lPlugIn.processClosed.call( this, lToken );
				}
			}
		}
		// in case of a server side close event...
		this.fConn = null;
		// reset the session...
		this.fSessionId = null;
		// and the username as well
		this.fUsername = null;
	},

	//:m:*:processPacket
	//:d:en:Is called when a new raw data packet is received by the client. _
	//:d:en:This methods calls the [tt]streamToToken[/tt] method of the _
	//:d:en:its descendant who is responsible to implement the sub protocol _
	//:d:en:JSON, CSV or XML, here to parse the raw packet in the corresponding _
	//:d:en:format.
	//:a:en::aEvent:Object:Event object from the browser's WebSocket instance.
	//:r:*:::void:none
	processPacket: function( aEvent ) {
		// parse incoming token...
		var lToken = this.streamToToken( aEvent.data );
		// and process it...
		this.processToken( lToken );
		return lToken;
	},

	// TODO: move handlers to system plug-in in the same way as on server.
	// TODO: No change for application!
	//:m:*:processToken
	//:d:en:Processes an incoming token. The method iterates through all _
	//:d:en:plug-ins and calls their specific [tt]processToken[/tt] method.
	//:a:en::aToken:Object:Token to be processed by the plug-ins in the plug-in chain.
	//:r:*:::void:none
	processToken: function( aToken ) {

		// TODO: Remove this temporary hack with final release 1.0
		// TODO: this was required to ensure upward compatibility from 0.10 to 0.11
		var lNS = aToken.ns;
		if ( lNS != null && lNS.indexOf( "org.jWebSocket" ) == 1 ) {
			aToken.ns = "org.jwebsocket" + lNS.substring( 15 );
		} else if( lNS == null ) {
			aToken.ns = "org.jwebsocket.plugins.system";
		}

		// is it a token from the system plug-in at all?
		if( jws.NS_SYSTEM == aToken.ns ) {
			// check welcome and goodBye tokens to manage the session
			if( aToken.type == "welcome" && aToken.usid ) {
				this.fSessionId = aToken.usid;
				this.fClientId = aToken.sourceId;
				this.notifyPlugInsOpened();
				// fire OnWelcome Event if assigned
				if( this.fOnWelcome ) {
					this.fOnWelcome( aToken );
				}
				var lFlashBridgeVer = "n/a";
				if( swfobject) {
					var lInfo = swfobject.getFlashPlayerVersion();
					lFlashBridgeVer = lInfo.major + "." + lInfo.minor + "." + lInfo.release;
				}
				this.sendToken({
					ns: jws.SystemClientPlugIn.NS,
					type: "header",
					clientType: "browser",
					clientName: jws.getBrowserName(),
					clientVersion: jws.getBrowserVersionString(),
					clientInfo: navigator.userAgent,
					jwsType: "javascript",
					jwsVersion: jws.VERSION,
					jwsInfo:
						jws.browserSupportsNativeWebSockets
							? "native"
							: "flash " + lFlashBridgeVer
					}, {
					}
				);
			} else if( aToken.type == "goodBye" ) {
				// fire OnGoodBye Event if assigned
				if( this.fOnGoodBye ) {
					this.fOnGoodBye( aToken );
				}
				this.fSessionId = null;
				this.fUsername = null;
			} else if( aToken.type == "close" ) {
				// if the server closes the connection close immediately too.
				this.close({
					timeout: 0
				});
			// check if we got a response from a previous request
			} else if( aToken.type == "response" ) {
				// check login and logout manage the username
				if( aToken.reqType == "login" ) {
					this.fUsername = aToken.username;
					// if re-login used previous session-id re-assign it here!
					if( aToken.usid ) {
						this.fSessionId = aToken.usid;
					}
				}
				if( aToken.reqType == "logout" ) {
					this.fUsername = null;
				}
				// check if some requests need to be answered
				this.checkCallbacks( aToken );
			} else if( aToken.type == "event" ) {
				// check login and logout manage the username
				if( aToken.name == "connect" ) {
					this.processConnected( aToken );
				}
				if( aToken.name == "disconnect" ) {
					this.processDisconnected( aToken );
				}
			}
		} else {
			// check the incoming token for an optional response callback
			this.checkCallbacks( aToken );
		}

		var lIdx, lLen, lPlugIns, lPlugIn;

		// notify all plug-ins bound to the class
		// that a token has to be processed
		lPlugIns = jws.jWebSocketTokenClient.fPlugIns;
		if( lPlugIns ) {
			for( lIdx = 0, lLen = lPlugIns.length; lIdx < lLen; lIdx++ ) {
				lPlugIn = lPlugIns[ lIdx ];
				if( lPlugIn.processToken ) {
					lPlugIn.processToken.call( this, aToken );
				}
			}
		}

		// notify all plug-ins bound to the instance
		// that a token has to be processed
		lPlugIns = this.fPlugIns;
		if( lPlugIns ) {
			for( lIdx = 0, lLen = lPlugIns.length; lIdx < lLen; lIdx++ ) {
				lPlugIn = lPlugIns[ lIdx ];
				if( lPlugIn.processToken ) {
					lPlugIn.processToken( aToken );
				}
			}
		}

		// if the instance got an OnToken event assigned
		// fire the event
		if( this.fOnToken ) {
			this.fOnToken( aToken );
		}

		if( this.fListeners ) {
			for( lIdx = 0, lLen = this.fListeners.length; lIdx < lLen; lIdx++ ) {
				this.fListeners[ lIdx ]( aToken );
			}
		}

	},

	//:m:*:processClosed
	//:d:en:Iterates through all plug-ins of the plugin-chain and calls their _
	//:d:en:specific [tt]processClosed[/tt] method.
	//:a:en::aEvent:Object:...
	//:r:*:::void:none
	processClosed: function( aEvent ) {
		this.notifyPlugInsClosed();
		this.fClientId = null;
	},

	//:m:*:processConnected
	//:d:en:Called when the client successfully received a connect event token _
	//:d:en:which means that another client has connected to the network.
	//:a:en::aToken:Object:...
	//:r:*:::void:none
	processConnected: function( aToken ) {
		// notify all plug-ins that a new client connected
		var lPlugIns = jws.jWebSocketTokenClient.fPlugIns;
		if( lPlugIns ) {
			for( var lIdx = 0, lLen = lPlugIns.length; lIdx < lLen; lIdx++ ) {
				var lPlugIn = lPlugIns[ lIdx ];
				if( lPlugIn.processConnected ) {
					lPlugIn.processConnected.call( this, aToken );
				}
			}
		}
	},

	//:m:*:processDisconnected
	//:d:en:Called when the client successfully received a disconnect event token _
	//:d:en:which means that another client has disconnected from the network.
	//:a:en::aToken:Object:...
	//:r:*:::void:none
	processDisconnected: function( aToken ) {
		// notify all plug-ins that a client disconnected
		var lPlugIns = jws.jWebSocketTokenClient.fPlugIns;
		if( lPlugIns ) {
			for( var lIdx = 0, lLen = lPlugIns.length; lIdx < lLen; lIdx++ ) {
				var lPlugIn = lPlugIns[ lIdx ];
				if( lPlugIn.processDisconnected ) {
					lPlugIn.processDisconnected.call( this, aToken );
				}
			}
		}
	},

	//:m:*:sendToken
	//:d:en:Sends a token to the jWebSocket server.
	//:a:en::aToken:Object:Token to be send to the jWebSocket server.
	//:a:en::aOptions:Object:Optional arguments as listed below...
	//:a:en:aOptions:OnResponse:Function:Reference to callback function, which is called when the response is received.
	//:r:*:::void:none
	sendToken: function( aToken, aOptions ) {
		var lRes = this.checkWriteable();
		if( lRes.code == 0 ) {
			var lSpawnThread = false;
			var lL2FragmSize = 0;
			var lTimeout = jws.DEF_RESP_TIMEOUT;
			var lArgs = null;
			var lCallbacks = {
				OnResponse: null,
				OnSuccess: null,
				OnError: null,
				OnTimeout: null
			};
			// we need to check for a response only
			// if correspondig callbacks are set
			var lControlResponse = false;
			if( aOptions ) {
				if( aOptions.OnResponse ) {
					lCallbacks.OnResponse = aOptions.OnResponse;
					lControlResponse = true;
				}
				if( aOptions.OnError ) {
					lCallbacks.OnError = aOptions.OnError;
					lControlResponse = true;
				}
				if( aOptions.OnSuccess ) {
					lCallbacks.OnSuccess = aOptions.OnSuccess;
					lControlResponse = true;
				}
				if( aOptions.OnTimeout ) {
					lCallbacks.OnTimeout = aOptions.OnTimeout;
					lControlResponse = true;
				}
				if( aOptions.args ) {
					lArgs = aOptions.args;
				}
				if( aOptions.timeout ) {
					lTimeout = aOptions.timeout;
				}
				if( aOptions.spawnThread ) {
					lSpawnThread = aOptions.spawnThread;
				}
				if( aOptions.fragmentSize ) {
					lL2FragmSize = aOptions.fragmentSize;
				}
			}
			jws.CUR_TOKEN_ID++;
			if( lControlResponse ) {
				var lUTID = jws.CUR_TOKEN_ID;
				var lClbkId = "utid" + lUTID;
				var lThis = this;
				var lClbkRec = {
					request: new Date().getTime(),
					callback: lCallbacks,
					args: lArgs,
					timeout: lTimeout
				};
				this.fRequestCallbacks[ lClbkId ] = lClbkRec;
				// set timeout to observe response
				lClbkRec.hCleanUp = setTimeout( function() {
					var lCallbacks = lClbkRec.callback;
					// delete callback first to not fire response event
					// in case the OnTimeout processing takes longer or
					// even invokes blocking methods like alert.
					delete lThis.fRequestCallbacks[ lClbkId ];
					// now the OnTimeout Callback can be called.
					if( lCallbacks.OnTimeout ) {
						lCallbacks.OnTimeout({
							utid: lUTID,
							timeout: lTimeout,
							token: aToken
						});
					}
				}, lTimeout );
			}
			if( lSpawnThread ) {
				aToken.spawnThread = true;
			}
			var lStream = this.tokenToStream( aToken );
			if( lL2FragmSize > 0 && lStream.length > 0 ) {
				var lToken, lFragment, lFragmId = 0, lStart = 0, lTotal = lStream.length;
				while( lStream.length > 0 ) {
					lToken = {
						ns: jws.NS_SYSTEM,
						type: "fragment",
						utid: aToken.utid,
						index: lFragmId++,
						total: parseInt( lTotal / lL2FragmSize ) + 1,
						data: lStream.substr( 0, lL2FragmSize )
					};
					lStart += lL2FragmSize;
					lStream = lStream.substr( lL2FragmSize );
					lFragment = this.tokenToStream( lToken );
					this.sendStream( lFragment );
					// console.log( "sending fragment " + lFragment + "..." );
				}
			} else {
				// console.log( "sending stream " + lStream + "..." );
				this.sendStream( lStream );
			}
		}
		return lRes;
	},

	//:m:*:getLastTokenId
	//:d:en:Returns the last token id that has been used for the last recent
	//:d:en:request.This id was already used and cannot be used for further
	//:d:en:tranmissions.
	//:a:en::::none
	//:r:*:::Integer:Last recently used unique token-id.
	getLastTokenId: function() {
		return jws.CUR_TOKEN_ID;
	},

	//:m:*:getNextTokenId
	//:d:en:Returns the next token id that will be used for the next request.
	//:d:en:This id will be used by the next sendToken call.
	//:a:en::::none
	//:r:*:::Integer:Next unique token-id used for the next sendToken call.
	getNextTokenId: function() {
		return jws.CUR_TOKEN_ID + 1;
	},

	//:m:*:sendText
	//:d:en:Sends a simple text message to a certain target client within the _
	//:d:en:WebSocket network by creating and sending a [tt]send[/tt] token. _
	//:d:en:The receiver must be addressed by its client id.
	//:d:en:This method requires the user to be authenticated.
	//:a:en::aTarget:String:Client id of the target client for the message.
	//:a:en::aText:String:Textmessage to be send to the target client.
	//:r:*:::void:none
	sendText: function( aTarget, aText ) {
		var lRes = this.checkLoggedIn();
		if( lRes.code == 0 ) {
			this.sendToken({
				ns: jws.NS_SYSTEM,
				type: "send",
				targetId: aTarget,
				sourceId: this.fClientId,
				sender: this.fUsername,
				data: aText
			});
		}
		return lRes;
	},

	//:m:*:broadcastText
	//:d:en:Broadcasts a simple text message to all clients or a limited set _
	//:d:en:of clients within the WebSocket network by creating and sending _
	//:d:en:a [tt]broadcast[/tt] token. The caller can decide to wether or not _
	//:d:en:included in the broadcast and if he requests a response (optional _
	//:d:en:"one-way" token).
	//:d:en:This method requires the user to be authenticated.
	//:a:en::aPool:String:...
	//:a:en::aText:type:...
	//:a:en::aOptions:Object:...
	//:a:en:aOptions:senderIncluded:Boolean:..., default [tt]false[/tt].
	//:a:en:aOptions:responseRequested:Boolean:..., default [tt]true[/tt].
	//:r:*:::void:none
	broadcastText: function( aPool, aText, aOptions ) {
		var lRes = this.checkLoggedIn();
		var lSenderIncluded = false;
		var lResponseRequested = true;
		if( aOptions ) {
			if( aOptions.senderIncluded ) {
				lSenderIncluded = aOptions.senderIncluded;
			}
			if( aOptions.responseRequested ) {
				lResponseRequested = aOptions.responseRequested;
			}
		}
		if( lRes.code == 0 ) {
			this.sendToken({
				ns: jws.NS_SYSTEM,
				type: "broadcast",
				sourceId: this.fClientId,
				sender: this.fUsername,
				pool: aPool,
				data: aText,
				senderIncluded: lSenderIncluded,
				responseRequested: lResponseRequested
			},
			aOptions
			);
		}
		return lRes;
	},

	//:m:*:echo
	//:d:en:Sends an echo token to the jWebSocket server. The server returns
	//:d:en:the same message with a prefix.
	//:a:en::aData:String:An arbitrary string to be returned by the server.
	//:r:*:::void:none
	echo: function( aData ) {
		var lRes = this.checkWriteable();
		if( lRes.code == 0 ) {
			this.sendToken({
				ns: jws.NS_SYSTEM,
				type: "echo",
				data: aData
			});
		}
		return lRes;
	},

	//:m:*:open
	//:d:en:Tries to establish a connection to the jWebSocket server. Unlike _
	//:d:en:the inherited [tt]open[/tt] method no exceptions is fired in case _
	//:d:en:of an error but a response token is returned.
	//:a:en::aURL:String:URL to the jWebSocket server.
	//:a:en::aOptions:Object:Optional arguments, for details please refer to the open method of the [tt]jWebSocketBaseClient[/tt] class.
	//:r:*:::Object:The response token.
	//:r:*:Object:code:Number:Response code (0 = ok, otherwise error).
	//:r:*:Object:msg:String:"Ok" or error message.
	open: function( aURL, aOptions ) {
		var lRes = this.createDefaultResult();
		try {
			if( aOptions && aOptions.OnToken && typeof aOptions.OnToken == "function" ) {
				this.fOnToken = aOptions.OnToken;
			}
			if( aOptions && aOptions.OnWelcome && typeof aOptions.OnWelcome == "function" ) {
				this.fOnWelcome = aOptions.OnWelcome;
			}
			if( aOptions && aOptions.OnGoodBye && typeof aOptions.OnGoodBye == "function" ) {
				this.fOnGoodBye = aOptions.OnGoodBye;
			}
			// call inherited connect, catching potential exception
			arguments.callee.inherited.call( this, aURL, aOptions );
		} catch( ex ) {
			lRes.code = -1;
			lRes.localeKey = "jws.jsc.ex";
			lRes.args = [ ex.message ];
			lRes.msg = "Exception on open: " + ex.message;
		}
		return lRes;
	},

	//:m:*:connect
	//:d:en:Deprecated, kept for upward compatibility only. Do not use anymore!
	//:d:en:Please refer to the [tt]open[/tt] method.
	//:a:en:::Deprecated:Please refer to the [tt]open[/tt] method.
	//:r:*:::Deprecated:Please refer to the [tt]open[/tt] method.
	connect: function( aURL, aOptions ) {
		return this.open( aURL, aOptions );
	},

	//:m:*:close
	//:d:en:Closes an established WebSocket connection.
	//:a:en::aOptions:Object:Optional arguments as listed below...
	//:a:en:aOptions:timeout:Number:Timeout in milliseconds.
	//:r:*:::void:none
	close: function( aOptions ) {
		var lTimeout = 0;

		var lNoGoodBye = false;
		var lNoLogoutBroadcast = false;
		var lNoDisconnectBroadcast = false;

		// turn on isExplicitClose flag to not auto re-connect in case
		// of an explicit, i.e. desired client side close operation
		if( this.fReliabilityOptions ) {
			this.fReliabilityOptions.isExplicitClose = true;
		}

		if( aOptions ) {
			if( aOptions.timeout ) {
				lTimeout = aOptions.timeout;
			}
			if( aOptions.noGoodBye ) {
				lNoGoodBye = true;
			}
			if( aOptions.noLogoutBroadcast ) {
				lNoLogoutBroadcast = true;
			}
			if( aOptions.noDisconnectBroadcast ) {
				lNoDisconnectBroadcast = true;
			}
		}
		var lRes = this.checkConnected();
		try {
			// if connected and timeout is passed give server a chance to
			// register the disconnect properly and send a good bye response.
			if( lRes.code == 0 ) {
				var lToken = {
					ns: jws.NS_SYSTEM,
					type: "close",
					timeout: lTimeout
				};
				// only add the following optional fields to
				// the close token on explicit request
				if( lNoGoodBye ) {
					lToken.noGoodBye = true;
				}
				if( lNoLogoutBroadcast ) {
					lToken.noLogoutBroadcast = true;
				}
				if( lNoDisconnectBroadcast ) {
					lToken.noDisconnectBroadcast = true;
				}
				this.sendToken( lToken );
				// call inherited disconnect, catching potential exception
				arguments.callee.inherited.call( this, aOptions );
			} else {
				lRes.code = -1;
				lRes.localeKey = "jws.jsc.res.notConnected";
				lRes.msg = "Not connected.";
			}
		} catch( ex ) {
			lRes.code = -1;
			lRes.localeKey = "jws.jsc.ex";
			lRes.args = [ ex.message ];
			lRes.msg = "Exception on close: " + ex.message;
		}
		return lRes;
	},

	//:m:*:disconnect
	//:d:en:Deprecated, kept for upward compatibility only. Do not use anymore!
	//:d:en:Please refer to the [tt]close[/tt] method.
	//:a:en:::Deprecated:Please refer to the [tt]close[/tt] method.
	//:r:*:::Deprecated:Please refer to the [tt]close[/tt] method.
	disconnect: function( aOptions ) {
		return this.close( aOptions );
	}

});


//	---------------------------------------------------------------------------
//  jWebSocket Client System Plug-In
//	---------------------------------------------------------------------------

//:package:*:jws
//:class:*:jws.SystemClientPlugIn
//:ancestor:*:-
//:d:en:Implementation of the [tt]jws.SystemClientPlugIn[/tt] class.
jws.SystemClientPlugIn = {

	//:const:*:NS:String:org.jwebsocket.plugins.system (jws.NS_BASE + ".plugins.system")
	//:d:en:Namespace for SystemClientPlugIn
	// if namespace changed update server plug-in accordingly!
	NS: jws.NS_SYSTEM,

	//:const:*:ALL_CLIENTS:Number:0
	//:d:en:For [tt]getClients[/tt] method: Returns all currently connected clients irrespective of their authentication state.
	ALL_CLIENTS: 0,
	//:const:*:AUTHENTICATED:Number:1
	//:d:en:For [tt]getClients[/tt] method: Returns all authenticated clients only.
	AUTHENTICATED: 1,
	//:const:*:NON_AUTHENTICATED:Number:2
	//:d:en:For [tt]getClients[/tt] method: Returns all non-authenticated clients only.
	NON_AUTHENTICATED: 2,

	//:const:*:PW_PLAIN:Number:null
	//:d:en:Use no password encoding, password is passed as plain text.
	PW_PLAIN		: null,
	//:const:*:PW_ENCODE_MD5:Number:1
	//:d:en:Use MD5 password encoding, password is given as plain but converted and passed as a MD5 hash.
	PW_ENCODE_MD5	: 1,
	//:const:*:PW_MD5_ENCODED:Number:2
	//:d:en:Use MD5 password encoding, password is given and passed as a MD5 hash. _
	//:d:en:The method relies on the correct encoding and does not check the hash.
	PW_MD5_ENCODED	: 2,

	//:m:*:login
	//:d:en:Tries to authenticate the client against the jWebSocket Server by _
	//:d:en:sending a [tt]login[/tt] token.
	//:a:en::aUsername:String:The login name of the user.
	//:a:en::aPassword:String:The password of the user.
	//:a:en::aOptions:Object:Optional arguments as listed below...
	//:a:en:aOptions:pool:String:Default pool the user want to register at (default [tt]null[/tt], no pool).
	//:a:en:aOptions:autoConnect:Boolean:not yet supported (defautl [tt]true[/tt]).
	//:r:*:::void:none
	login: function( aUsername, aPassword, aOptions ) {
		var lPool = null;
		var lEncoding = null;
		if( aOptions ) {
			if( aOptions.pool !== undefined ) {
				lPool = aOptions.pool;
			}
			if( aOptions.encoding !== undefined ) {
				lEncoding = aOptions.encoding;
				// check if password has to be converted into a MD5 sum
				if( jws.SystemClientPlugIn.PW_ENCODE_MD5 == lEncoding ) {
					if( aPassword ) {
						aPassword = jws.tools.calcMD5( aPassword );
					}
					lEncoding = "md5";
				// check if password is already md5 encoded
				} else if( jws.SystemClientPlugIn.PW_MD5_ENCODED == lEncoding ) {
					lEncoding = "md5";
				} else {
					// TODO: raise error here due to invalid encoding option
					lEncoding = null;
				}
			}
		}
		var lRes = this.createDefaultResult();
		if( this.isOpened() ) {
			this.sendToken({
				ns: jws.SystemClientPlugIn.NS,
				type: "login",
				username: aUsername,
				password: aPassword,
				encoding: lEncoding,
				pool: lPool
			});
		} else {
			lRes.code = -1;
			lRes.localeKey = "jws.jsc.res.notConnected";
			lRes.msg = "Not connected.";
		}
		return lRes;
	},

	//:m:*:logon
	//:d:en:Tries to connect and authenticate the client against the _
	//:d:en:jWebSocket Server in a single call. If the client is already _
	//:d:en:connected this connection is used and not re-established. _
	//:d:en:If the client is already authenticated he is logged off first and _
	//:d:en:re-logged in afterwards by sending a [tt]login[/tt] token.
	//:d:en:The logoff of the client in case of a re-login is automatically _
	//:d:en:processed by the jWebSocket server and does not need to be _
	//:d:en:explicitely triggered by the client.
	// TODO: check server if it sends logout event in ths case!
	//:a:en::aURL:String:The URL of the jWebSocket Server.
	//:a:en::aUsername:String:The login name of the user.
	//:a:en::aPassword:String:The password of the user.
	//:a:en::aOptions:Object:Optional arguments as listed below...
	// TODO: document options!
	//:r:*:::void:none
	logon: function( aURL, aUsername, aPassword, aOptions ) {
		var lRes = this.createDefaultResult();
		if( !aOptions ) {
			aOptions = {};
		}
		// if already connected, just send the login token
		if( this.isOpened() ) {
			this.login( aUsername, aPassword, aOptions );
		} else {
			var lAppOnWelcomeClBk = aOptions.OnWelcome;
			var lThis = this;
			aOptions.OnWelcome = function( aEvent ) {
				if( lAppOnWelcomeClBk ) {
					lAppOnWelcomeClBk.call( lThis, aEvent );
				}
				lThis.login( aUsername, aPassword, aOptions );
			};
			this.open(
				aURL,
				aOptions
			);
		}
		return lRes;
	},

	//:m:*:logout
	//:d:en:Logs the currently authenticated used out. After that the user _
	//:d:en:is not authenticated anymore against the jWebSocket network. _
	//:d:en:The client is not automatically disconnected.
	//:d:en:If you want to logout and disconnect please refere to the _
	//:d:en:[tt]close[/tt] method. Closing a connection automatically logs off _
	//:d:en:a potentially authenticated user.
	// TODO: implement optional auto disconnect!
	//:a:en::::none
	//:r:*:::void:none
	logout: function() {
		var lRes = this.checkConnected();
		if( lRes.code == 0 ) {
			this.sendToken({
				ns: jws.SystemClientPlugIn.NS,
				type: "logout"
			});
		}
		return lRes;
	},

	//:m:*:isLoggedIn
	//:d:en:Returns [tt]true[/tt] when the client is authenticated, _
	//:d:en:otherwise [tt]false[/tt].
	//:a:en::::none
	//:r:*:::Boolean:[tt]true[/tt] when the client is authenticated, otherwise [tt]false[/tt].
	isLoggedIn: function() {
		return( this.isOpened() && this.fUsername );
	},

	broadcastToken: function( aToken, aOptions ) {
		aToken.ns = jws.SystemClientPlugIn.NS;
		aToken.type = "broadcast";
		aToken.sourceId = this.fClientId;
		aToken.sender = this.fUsername;
		return this.sendToken( aToken, aOptions );
	},

	//:m:*:getUsername
	//:d:en:Returns the login name when the client is authenticated, _
	//:d:en:otherwise [tt]null[/tt].
	//:d:en:description pending...
	//:a:en::::none
	//:r:*:::String:Login name when the client is authenticated, otherwise [tt]null[/tt].
	getUsername: function() {
		return( this.isLoggedIn() ? this.fUsername : null );
	},

	//:m:*:getClients
	//:d:en:Returns an array of clients that are currently connected to the
	//:d:en:jWebSocket network by using the [tt]getClients[/tt] token.
	//:d:en:Notice that the call is non-blocking, i.e. the clients are _
	//:d:en:returned asynchronously by the OnResponse event.
	//:a:en::aOptions:Object:Optional arguments as listed below...
	// TODO: support and/or check pool here!
	//:a:en:aOptions:pool:String:Only consider connections to that certain pool (default=[tt]null[/tt]).
	//:a:en:aOptions:mode:Number:One of the following constants [tt]AUTHENTICATED[/tt], [tt]NON_AUTHENTICATED[/tt], [tt]ALL_CLIENTS[/tt].
	//:r:*:::void:none
	getClients: function( aOptions ) {
		var lMode = jws.SystemClientPlugIn.ALL_CLIENTS;
		var lPool = null;
		if( aOptions ) {
			if( aOptions.mode == jws.SystemClientPlugIn.AUTHENTICATED ||
				aOptions.mode == jws.SystemClientPlugIn.NON_AUTHENTICATED ) {
				lMode = aOptions.mode;
			}
			if( aOptions.pool ) {
				lPool = aOptions.pool;
			}
		}
		var lRes = this.createDefaultResult();
		if( this.isLoggedIn() ) {
			this.sendToken({
				ns: jws.SystemClientPlugIn.NS,
				type: "getClients",
				mode: lMode,
				pool: lPool
			});
		} else {
			lRes.code = -1;
			lRes.localeKey = "jws.jsc.res.notLoggedIn";
			lRes.msg = "Not logged in.";
		}
		return lRes;
	},

	//:m:*:getNonAuthClients
	//:d:en:Requests an array of all clients that are currently connected to _
	//:d:en:the jWebSocket network but not authenticated.
	//:d:en:Notice that the call is non-blocking, i.e. the clients are _
	//:d:en:returned asynchronously by the OnResponse event.
	//:a:en::aOptions:Object:Please refer to the [tt]getClients[/tt] method.
	//:r:*:::void:none
	getNonAuthClients: function( aOptions ) {
		if( !aOptions ) {
			aOptions = {};
		}
		aOptions.mode = jws.SystemClientPlugIn.NON_AUTHENTICATED;
		return this.getClients( aOptions );
	},

	//:m:*:getAuthClients
	//:d:en:Requests an array of all clients that are currently connected to _
	//:d:en:the jWebSocket network and that are authenticated.
	//:d:en:Notice that the call is non-blocking, i.e. the clients are _
	//:d:en:returned asynchronously by the OnResponse event.
	//:a:en::aOptions:Object:Please refer to the [tt]getClients[/tt] method.
	//:r:*:::void:none
	getAuthClients: function( aOptions ) {
		if( !aOptions ) {
			aOptions = {};
		}
		aOptions.mode = jws.SystemClientPlugIn.AUTHENTICATED;
		return this.getClients( aOptions );
	},

	//:m:*:getAllClients
	//:d:en:Requests an array of all clients that are currently connected to _
	//:d:en:the jWebSocket network irrespective of their authentication status.
	//:d:en:Notice that the call is non-blocking, i.e. the clients are _
	//:d:en:returned asynchronously by the OnResponse event.
	//:a:en::aOptions:Object:Please refer to the [tt]getClients[/tt] method.
	//:r:*:::void:none
	getAllClients: function( aOptions ) {
		if( !aOptions ) {
			aOptions = {};
		}
		aOptions.mode = jws.SystemClientPlugIn.ALL_CLIENTS;
		return this.getClients( aOptions );
	},

	//:m:*:ping
	//:d:en:Sends a simple [tt]ping[/tt] token to the jWebSocket Server as a _
	//:d:en:notification that the client is still alive. The client optionally _
	//:d:en:can request an echo so that the client also get a notification _
	//:d:en:that the server still is alive. The [tt]ping[/tt] thus is an _
	//:d:en:important part of the jWebSocket connection management.
	//:a:en::aOptions:Object:Optional arguments as listed below...
	//:a:en:aOptions:echo:Boolean:Specifies whether the client expects a response from the server (default=[tt]true[/tt]).
	//:r:*:::void:none
	ping: function( aOptions ) {
		var lEcho = false;
		if( aOptions ) {
			if( aOptions.echo ) {
				lEcho = true;
			}
		}
		var lRes = this.createDefaultResult();
		if( this.isOpened() ) {
			this.sendToken({
				ns: jws.SystemClientPlugIn.NS,
				type: "ping",
				echo: lEcho
				},
				aOptions
			);
		} else {
			lRes.code = -1;
			lRes.localeKey = "jws.jsc.res.notConnected";
			lRes.msg = "Not connected.";
		}
		return lRes;
	},

	//:m:*:wait
	//:d:en:Simply send a wait request to the jWebSocket server. _
	//:d:en:The server waits for the given amount of time and returns a _
	//:d:en:result token. This feature is for test and debugging purposes only _
	//:d:en:and is not related to any particular business logic.
	//:a:en::aDuration:Integer:Duration in ms the server waits for a response
	//:a:en::aOptions:Object:Optional arguments as listed below...
	//:a:en:aOptions:OnResponse:Function:Callback to be invoked once the response is received.
	//:r:*:::void:none
	wait: function( aDuration, aOptions ) {
		var lRes = this.checkConnected();
		if( lRes.code == 0 ) {
			var lResponseRequested = true;
			if( aOptions ) {
				if( aOptions.responseRequested != undefined ) {
					lResponseRequested = aOptions.responseRequested;
				}
			}
			this.sendToken({
				ns: jws.SystemClientPlugIn.NS,
				type: "wait",
				duration: aDuration,
				responseRequested: lResponseRequested
				},
				aOptions
			);
		}
		return lRes;
	},

	//:m:*:startKeepAlive
	//:d:en:Starts the keep-alive timer in background. keep-alive sends _
	//:d:en:periodic pings to the server with an configurable interval.
	//:d:en:If the keep-alive timer has already has been started, the previous _
	//:d:en:one will be stopped automatically and a new one with new options _
	//:d:en:will be initiated.
	//:a:en::aOptions:Objects:Optional arguments as listed below...
	//:a:en:aOptions:interval:Number:Number of milliseconds for the interval.
	//:a:en:aOptions:echo:Boolean:Specifies wether the server is supposed to send an answer to the client.
	//:a:en:aOptions:immediate:Boolean:Specifies wether to send the first ping immediately or after the first interval.
	//:r:*:::void:none
	startKeepAlive: function( aOptions ) {
		// if we have a keep alive running already stop it
		if( this.hKeepAlive ) {
			stopKeepAlive();
		}
		// return if not (yet) connected
		if( !this.isOpened() ) {
			// TODO: provide reasonable result here!
			return;
		}
		var lInterval = 10000;
		var lEcho = true;
		var lImmediate = true;
		if( aOptions ) {
			if( aOptions.interval != undefined ) {
				lInterval = aOptions.interval;
			}
			if( aOptions.echo != undefined ) {
				lEcho = aOptions.echo;
			}
			if( aOptions.immediate != undefined ) {
				lImmediate = aOptions.immediate;
			}
		}
		if( lImmediate ) {
			// send first ping immediately, if requested
			this.ping({
				echo: lEcho
			});
		}
		// and then initiate interval...
		var lThis = this;
		this.hKeepAlive = setInterval(
			function() {
				if( lThis.isOpened() ) {
					lThis.ping({
						echo: lEcho
					});
				} else {
					lThis.stopKeepAlive();
				}
			},
			lInterval
		);
	},

	//:m:*:stopKeepAlive
	//:d:en:Stops the keep-alive timer in background. If no keep-alive is _
	//:d:en:running no operation is performed.
	//:a:en::::none
	//:r:*:::void:none
	stopKeepAlive: function() {
		// TODO: return reasonable results here
		if( this.hKeepAlive ) {
			clearInterval( this.hKeepAlive );
			this.hKeepAlive = null;
		}
	}
};

// add the JWebSocket SystemClient PlugIn into the BaseClient class
jws.oop.addPlugIn( jws.jWebSocketTokenClient, jws.SystemClientPlugIn );


//	---------------------------------------------------------------------------
//  jWebSocket JSON client
//	todo: consider potential security issues with 'eval'
//	---------------------------------------------------------------------------

//:package:*:jws
//:class:*:jws.jWebSocketJSONClient
//:ancestor:*:jws.jWebSocketTokenClient
//:d:en:Implementation of the [tt]jws.jWebSocketJSONClient[/tt] class.
jws.oop.declareClass( "jws", "jWebSocketJSONClient", jws.jWebSocketTokenClient, {

	//:m:*:tokenToStream
	//:d:en:converts a token to a JSON stream. If the browser provides a _
	//:d:en:native JSON class this is used, otherwise it use the automatically _
	//:d:en:embedded JSON library from json.org.
	//:a:en::aToken:Token:The token (an JavaScript Object) to be converted into an JSON stream.
	//:r:*:::String:The resulting JSON stream.
	tokenToStream: function( aToken ) {
		aToken.utid = jws.CUR_TOKEN_ID;
		var lJSON = JSON.stringify( aToken );
 		return( lJSON );
	},

	//:m:*:streamToToken
	//:d:en:converts a JSON stream into a token. If the browser provides a _
	//:d:en:native JSON class this is used, otherwise it use the automatically _
	//:d:en:embedded JSON library from json.org. For security reasons the _
	//:d:en:use of JavaScript's eval explicitely was avoided.
	//:a:en::aStream:String:The data stream received from the server to be parsed as JSON.
	//:r:*::Token:Object:The Token object of stream could be parsed successfully.
	//:r:*:Token:[i]field[/i]:[i]type[/i]:Fields of the token depend on its content and purpose and need to be interpreted by the higher level software tiers.
	streamToToken: function( aStream ) {
		// parsing a JSON object in JavaScript couldn't be simpler...
		var lObj = JSON.parse( aStream );
		return lObj;
	}

});


//	---------------------------------------------------------------------------
//  jWebSocket CSV client
//	todo: implement jWebSocket JavaScript CSV client
//	jWebSocket target release 1.1
//	---------------------------------------------------------------------------

//:package:*:jws
//:class:*:jws.jWebSocketCSVClient
//:ancestor:*:jws.jWebSocketTokenClient
//:d:en:Implementation of the [tt]jws.jWebSocketCSVClient[/tt] class.
jws.oop.declareClass( "jws", "jWebSocketCSVClient", jws.jWebSocketTokenClient, {

	// todo: implement escaping of command separators and equal signs
	//:m:*:tokenToStream
	//:d:en:converts a token to a CSV stream.
	//:a:en::aToken:Token:The token (an JavaScript Object) to be converted into an CSV stream.
	//:r:*:::String:The resulting CSV stream.
	tokenToStream: function( aToken ) {
		var lCSV = "utid=" + jws.CUR_TOKEN_ID;
		for( var lKey in aToken ) {
			var lVal = aToken[ lKey ];
			if( lVal === null || lVal === undefined ) {
				// simply do not generate a value, keep value field empty
				lCSV += "," + lKey + "=";
			} else if( typeof lVal == "string" ) {
				// escape commata and quotes
				lVal = lVal.replace( /[,]/g, "\\x2C" );
				lVal = lVal.replace( /["]/g, "\\x22" );
				lCSV += "," + lKey + "=\"" + lVal + "\"";
			} else {
				lCSV += "," + lKey + "=" + lVal;
			}
		}
		return lCSV;
	},

	// todo: implement escaping of command separators and equal signs
	//:m:*:streamToToken
	//:d:en:converts a CSV stream into a token.
	//:a:en::aStream:String:The data stream received from the server to be parsed as CSV.
	//:r:*::Token:Object:The Token object of stream could be parsed successfully.
	//:r:*:Token:[i]field[/i]:[i]type[/i]:Fields of the token depend on its content and purpose and need to be interpreted by the higher level software tiers.
	streamToToken: function( aStream ) {
		var lToken = {};
		var lItems = aStream.split(",");
		for( var lIdx = 0, lCnt = lItems.length; lIdx < lCnt; lIdx++ ) {
			var lKeyVal = lItems[ lIdx ].split( "=" );
			if( lKeyVal.length == 2 ) {
				var lKey = lKeyVal[ 0 ];
				var lVal = lKeyVal[ 1 ];
				if( lVal.length >= 2
					&& lVal.charAt(0)=="\""
					&& lVal.charAt(lVal.length-1)=="\"" ) {
					// unescape commata and quotes
					lVal = lVal.replace( /\\x2C/g, "\x2C" );
					lVal = lVal.replace( /\\x22/g, "\x22" );
					// strip string quotes
					lVal = lVal.substr( 1, lVal.length - 2 );
				}
				lToken[ lKey ] = lVal;
			}
		}
		return lToken;
	}

});


//	---------------------------------------------------------------------------
//  jWebSocket XML client
//	todo: PRELIMINARY! Implement jWebSocket JavaScript XML client
//	Targetted for jWebSocket release 1.1
//	---------------------------------------------------------------------------

//:package:*:jws
//:class:*:jws.jWebSocketXMLClient
//:ancestor:*:jws.jWebSocketTokenClient
//:d:en:Implementation of the [tt]jws.jWebSocketXMLClient[/tt] class.
jws.oop.declareClass( "jws", "jWebSocketXMLClient", jws.jWebSocketTokenClient, {

	//:m:*:tokenToStream
	//:d:en:converts a token to a XML stream.
	//:a:en::aToken:Token:The token (an JavaScript Object) to be converted into an XML stream.
	//:r:*:::String:The resulting XML stream.
	tokenToStream: function( aToken ) {

		function obj2xml( aKey, aValue ) {
			var lXML = "";
			// do we have an array? Caution! Keep this condition on
			// the top because array is also an object!
			if ( aValue instanceof Array ) {
				lXML += "<" + aKey + " type=\"" + "array" + "\">";
				for( var lIdx = 0, lCnt = aValue.length; lIdx < lCnt; lIdx++ ) {
					lXML += obj2xml( "item", aValue[ lIdx ] );
				}
				lXML += "</" + aKey + ">";
			}
			// or do we have an object?
			else if ( typeof aValue  == "object" ) {
				lXML += "<" + aKey + " type=\"" + "object" + "\">";
				for(var lField in aValue ) {
					lXML += obj2xml( lField, aValue[ lField ] );
				}
				lXML += "</" + aKey + ">";
			}
			// or do we have a plain field?
			else {
				lXML +=
				"<" + aKey + " type=\"" + typeof aValue + "\">" +
				aValue.toString() +
				"</" + aKey + ">";
			}
			return lXML;
		}

		var lEncoding = "windows-1252";
		var lResXML =
		"<?xml version=\"1.0\" encoding=\"" + lEncoding + "\"?>" +
		"<token>";
		for( var lField in aToken ) {
			lResXML += obj2xml( lField, aToken[ lField ] );
		}
		lResXML += "</token>";
		return lResXML;
	},

	//:m:*:streamToToken
	//:d:en:converts a XML stream into a token.
	//:a:en::aStream:String:The data stream received from the server to be parsed as XML.
	//:r:*::Token:Object:The Token object of stream could be parsed successfully.
	//:r:*:Token:[i]field[/i]:[i]type[/i]:Fields of the token depend on its content and purpose and need to be interpreted by the higher level software tiers.
	streamToToken: function( aStream ) {
		// first convert the stream into an XML document
		// by using the embedded XML parser.
		// We do not really want to parse the XML in Javascript!
		// Using the built-in parser should be more performant.
		var lDoc = null;
		/* Once we have an applet for IEx ;-)
		if( window.ActiveXObject ) {
			//:i:de:Internet Explorer
			lDoc = new ActiveXObject( "Microsoft.XMLDOM" );
			lDoc.async = "false";
			lDoc.loadXML( aStream );
		} else {
*/
		// For all other Browsers
		try{
			var lParser = new DOMParser();
			lDoc = lParser.parseFromString( aStream, "text/xml" );
		} catch( ex ) {
		// ignore exception here, lDoc will keep being null
		}
		/*
		}
*/

		function node2obj( aNode, aObj ) {
			var lNode = aNode.firstChild;
			while( lNode != null ) {
				// 1 = element node
				if( lNode.nodeType == 1 ) {
					var lType = lNode.getAttribute( "type" );
					var lKey = lNode.nodeName;
					if( lType ) {
						var lValue = lNode.firstChild;
						// 3 = text node
						if( lValue && lValue.nodeType == 3 ) {
							lValue = lValue.nodeValue;
							if( lValue ) {
								if( lType == "string" ) {
								} else if( lType == "number" ) {
								} else if( lType == "boolean" ) {
								} else if( lType == "date" ) {
								} else {
									lValue = undefined;
								}
								if( lValue ) {
									if ( aObj instanceof Array ) {
										aObj.push( lValue );
									} else {
										aObj[ lKey ] = lValue;
									}
								}
							}
						} else
						// 1 = element node
						if( lValue && lValue.nodeType == 1 ) {
							if( lType == "array" ) {
								aObj[ lKey ] = [];
								node2obj( lNode, aObj[ lKey ] );
							} else if( lType == "object" ) {
								aObj[ lKey ] = {};
								node2obj( lNode, aObj[ lKey ] );
							}
						}
					}
				}
				lNode = lNode.nextSibling;
			}
		}

		var lToken = {};
		if( lDoc ) {
			node2obj( lDoc.firstChild, lToken );
		}
		return lToken;
	}

});
if (jws.browserSupportsWebSockets()) {
	jWebSocketClient = new jws.jWebSocketJSONClient();
} else {
	alert(jws.MSG_WS_NOT_SUPPORTED);
}

var Craftys =  {
	gameKey: "",
	handlers: {},

	// Trigger event on all registered clients
	trigger: function(event, msg) {
		//console.log(msg);
		console.profile();

		jWebSocketClient.sendToken({ns: "crafty", type: "broadcast", event:event, data: msg });
		console.profileEnd();

	},
	// Trigger event on all registered clients except the sending one
	triggerRemote: function(event, msg) {
		//console.log(msg);
		jWebSocketClient.sendToken({ns: "crafty", type: "broadcast", "ExcludeSender": "true", event:event, data: msg });
	},

	// Register to a game space on server
	register: function(gameKey, callback) {
		this.gameKey = gameKey;
		var lRes = jWebSocketClient.logon("ws:localhost:8787", "sorenbs", "sss", {
			OnOpen: function(aEvent) {
				jWebSocketClient.sendToken({ns: "crafty", type: "registerForGame", gameKey: gameKey });
			},
			OnMessage: function(aEvent, aToken) {
				//console.log("jWebSocket '" + aToken.type + "' token received, full message: '" + aEvent.data);
				var payload = jWebSocketClient.streamToToken(aEvent.data)
				if(payload.type && payload.type === "Registered") {
					callback.call(this, payload.ClientCount);
				}
				if(payload.data) {
					if(payload.type === "trigger") {
						Crafty.trigger(payload.event, payload.data)
					}

				}
				//console.log(payload)
			},
			OnClose: function(aEvent) {
				console.log("jWebSocket connection closed.");
			}
		});
	}

}
