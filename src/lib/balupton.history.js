/**
 * History.js Core
 * Adapted from https://github.com/balupton/history.js for Javelin
 * @author Benjamin Arthur Lupton <contact@balupton.com>
 * @copyright 2010-2011 Benjamin Arthur Lupton <contact@balupton.com>
 * @license New BSD License <http://creativecommons.org/licenses/BSD/>
 */


JX.install( "History", {

	construct: function( options ){

		// TODO - figure out an elegant way to notify if multiple instances of the plugin 
		// are being initialised

		// Initialize all the members with proper values
		this.document       = window.document; // Make sure we are using the correct document
		this.navigator      = window.navigator; // Make sure we are using the correct navigator
		this.sessionStorage = window.sessionStorage||false; // sessionStorage
		this.history        = window.history; // Old History Object


		// ====================================================================
		// Interval record

		/**
		 * History.intervalList
		 * List of intervals set, to be cleared when document is unloaded.
		 */
		this.intervalList = [];


		// ====================================================================
		// Options
		// Extend with defaults where options are not specified

		// Keep a tab on the options
		this.options = options || {};

		/**
		 * this.options.hashChangeInterval
		 * How long should the interval be before hashchange checks
		 */
		this.options.hashChangeInterval = this.options.hashChangeInterval || 100;

		/**
		 * this.options.safariPollInterval
		 * How long should the interval be before safari poll checks
		 */
		this.options.safariPollInterval = this.options.safariPollInterval || 500;

		/**
		 * this.options.doubleCheckInterval
		 * How long should the interval be before we perform a double check
		 */
		this.options.doubleCheckInterval = this.options.doubleCheckInterval || 500;

		/**
		 * this.options.storeInterval
		 * How long should we wait between store calls
		 */
		this.options.storeInterval = this.options.storeInterval || 1000;

		/**
		 * this.options.busyDelay
		 * How long should we wait between busy events
		 */
		this.options.busyDelay = this.options.busyDelay || 250;

		/**
		 * this.options.debug
		 * If true will enable debug messages to be logged
		 */
		this.options.debug = this.options.debug || false;

		/**
		 * this.options.initialTitle
		 * What is the title of the initial state
		 */
		this.options.initialTitle = this.options.initialTitle || this.document.title;


		/**
		 * this.emulated
		 * Which features require emulating?
		 */
		this.emulated = {
			pushState: !Boolean(
				window.history && window.history.pushState && window.history.replaceState
				&& !(
					(/ Mobile\/([1-7][a-z]|(8([abcde]|f(1[0-8]))))/i).test( this.navigator.userAgent ) /* disable for versions of iOS before version 4.3 (8F190) */
					|| (/AppleWebKit\/5([0-2]|3[0-2])/i).test(this.navigator.userAgent) /* disable for the mercury iOS browser, or at least older versions of the webkit engine */
				)
			),
			hashChange: Boolean(
				!( ('onhashchange' in window) || ('onhashchange' in this.document) )
				||
				( this.isInternetExplorer() && this.getInternetExplorerMajorVersion() < 8 )
			)
		};

		/**
		 * History.enabled
		 * Is History enabled?
		 */
		this.enabled = !this.emulated.pushState;


		/**
		 * this.bugs
		 * Which bugs are present
		 */
		this.bugs = {
			/**
			 * Safari 5 and Safari iOS 4 fail to return to the correct state once a hash is replaced by a `replaceState` call
			 * https://bugs.webkit.org/show_bug.cgi?id=56249
			 */
			setHash: Boolean( !this.emulated.pushState && this.navigator.vendor === 'Apple Computer, Inc.' && /AppleWebKit\/5([0-2]|3[0-3])/.test(this.navigator.userAgent) ),

			/**
			 * Safari 5 and Safari iOS 4 sometimes fail to apply the state change under busy conditions
			 * https://bugs.webkit.org/show_bug.cgi?id=42940
			 */
			safariPoll: Boolean( !this.emulated.pushState && this.navigator.vendor === 'Apple Computer, Inc.' && /AppleWebKit\/5([0-2]|3[0-3])/.test(this.navigator.userAgent) ),

			/**
			 * MSIE 6 and 7 sometimes do not apply a hash even it was told to (requiring a second call to the apply function)
			 */
			ieDoubleCheck: Boolean( this.isInternetExplorer() && this.getInternetExplorerMajorVersion() < 8 ),

			/**
			 * MSIE 6 requires the entire hash to be encoded for the hashes to trigger the onHashChange event
			 */
			hashEscape: Boolean( this.isInternetExplorer() && this.getInternetExplorerMajorVersion() < 7 )
		};


		// ====================================================================
		// State Storage

		/**
		 * this.store
		 * The store for all session specific data
		 */
		this.store = {};

		/**
		 * this.idToState
		 * 1-1: State ID to State Object
		 */
		this.idToState = {};

		/**
		 * this.stateToId
		 * 1-1: State String to State ID
		 */
		this.stateToId = {};

		/**
		 * this.urlToId
		 * 1-1: State URL to State ID
		 */
		this.urlToId = {};

		/**
		 * this.storedStates
		 * Store the states in an array
		 */
		this.storedStates = [];

		/**
		 * this.savedStates
		 * Saved the states in an array
		 */
		this.savedStates = [];


		/**
		 * this.queues
		 * The list of queues to use
		 * First In, First Out
		 */
		this.queues = [];

		/**
		 * this.busy.flag
		 */
		this.busy.flag = false;


		// ====================================================================
		// IE Bug Fix

		/**
		 * History.stateChanged
		 * States whether or not the state has changed since the last double check was initialised
		 */
		this.stateChanged = false;

		/**
		 * History.doubleChecker
		 * Contains the timeout used for the double checks
		 */
		this.doubleChecker = false;


		// ====================================================================
		// HTML5 State Support


		// Check Load Status of Adapter
		/*if ( typeof this.options.Adapter === 'undefined' ) {
			JX.$E( "Please specify an adapter befor procedding with initialization of the History plugin" );
			return false;
		} else {
			this.Adapter = this.options.Adapter;
		}*/

		// Non-Native pushState Implementation
		// Replace the pre defined methods in the members
		if ( this.emulated.pushState ) {
			/*
			 * Provide Skeleton for HTML4 Browsers
			 */

			// Prepare
			var emptyFunction = function(){};
			this.pushState    = emptyFunction;
			this.replaceState = emptyFunction;
		} else {
			JX.Stratcom.listen( 'popstate', null, JX.bind( this.onPopState ) )
			//this.Adapter.bind( window, 'popstate', this.onPopState );
		}


		// ====================================================================
		// Initialise

		/**
		 * Load the Store
		 */
		if ( this.sessionStorage ) {
			// Fetch
			try {
				this.store = JX.JSON.parse( this.sessionStorage.getItem( 'History.store' ) ) || {};
			}
			catch ( err ) {
				this.store = {};
			}
		}
		else {
			// Default Load
			this.store = {};
		}
		// Normalize
		this.normalizeStore();

		/**
		 * Clear Intervals on exit to prevent memory leaks
		 */
		JX.Stratcom.listen( 'beforeunload', null, JX.bind( this.clearAllIntervals ) );
		JX.Stratcom.listen( 'unload', null, JX.bind( this.clearAllIntervals ) );

		/**
		 * Create the initial State
		 */
		this.saveState( this.storeState( this.extractState( this.document.location.href, true ) ) );

		/**
		 * Bind for Saving Store
		 */
		if ( this.sessionStorage ) {
			// When the page is closed
			this.onUnload = function(){
				// Prepare
				var	currentStore, item;

				// Fetch
				try {
					currentStore = JX.JSON.parse( this.sessionStorage.getItem( 'History.store' ) ) || {};
				}
				catch ( err ) {
					currentStore = {};
				}

				// Ensure
				currentStore.idToState = currentStore.idToState || {};
				currentStore.urlToId   = currentStore.urlToId || {};
				currentStore.stateToId = currentStore.stateToId || {};

				// Sync
				for ( item in this.idToState ) {
					if ( !this.idToState.hasOwnProperty( item ) ) {
						continue;
					}
					currentStore.idToState[ item ] = this.idToState[ item ];
				}
				for ( item in this.urlToId ) {
					if ( !this.urlToId.hasOwnProperty( item ) ) {
						continue;
					}
					currentStore.urlToId[ item ] = this.urlToId[ item ];
				}
				for ( item in this.stateToId ) {
					if ( !this.stateToId.hasOwnProperty( item ) ) {
						continue;
					}
					currentStore.stateToId[ item ] = this.stateToId[ item ];
				}

				// Update
				this.store = currentStore;
				this.normalizeStore();

				// Store
				this.sessionStorage.setItem( 'History.store', JX.JSON.stringify( currentStore ) );
			};

			// For Internet Explorer
			this.intervalList.push( setInterval( JX.bind( this, this.onUnload ), this.options.storeInterval ) );
			
			// For Other Browsers
			JX.Stratcom.listen( 'beforeunload', null, JX.bind( this.onUnload ) );
			JX.Stratcom.listen( 'unload', null, JX.bind( this.onUnload ) );
			//this.Adapter.bind( window, 'beforeunload', this.onUnload);
			//this.Adapter.bind( window, 'unload', this.onUnload);
			
			// Both are enabled for consistency
		}

		// Non-Native pushState Implementation
		if ( !this.emulated.pushState ) {
			// Be aware, the following is only for native pushState implementations
			// If you are wanting to include something for all browsers
			// Then include it above this if block

			/**
			 * Setup Safari Fix
			 */
			if ( this.bugs.safariPoll ) {
				this.intervalList.push( setInterval( JX.bind( this, this.safariStatePoll ), this.options.safariPollInterval ) );
			}

			/**
			 * Ensure Cross Browser Compatibility
			 */
			if ( this.navigator.vendor === 'Apple Computer, Inc.' || ( this.navigator.appCodeName || '' ) === 'Mozilla' ) {
				/**
				 * Fix Safari HashChange Issue
				 */

				// Setup Alias
				JX.Stratcom.listen( 
					'hashchange', null, 
					JX.bind( this, function(){
						JX.Stratcom.invoke( 'popstate' );
					}) 
				)
				//this.Adapter.bind( window, 'hashchange', JX.bind( this, function(){
				//	this.Adapter.trigger( window, 'popstate' );
				//}));

				// Initialise Alias
				if ( this.getHash() ) {
					JX.onload(
						JX.bind( this, function(){
							JX.Stratcom.invoke( 'hashchange' );
						}) 
					);
					/*this.Adapter.onDomLoad( JX.bind( this, function(){
						this.Adapter.trigger( window,'hashchange' );
					}));*/
				}
			}

		}


	},

	events: [ 'anchorchange', 'statechange' ],

	members: {
		Adapter: null,
		options: null,

		document:       null,
		navigator:      null,
		sessionStorage: null,
		history:        null,
		intervalList:   null,
		enabled:        null,

		emulated: null,
		bugs:     null,

		// State Storage
		store:        null,
		idToState:    null,
		stateToId:    null,
		urlToId:      null,
		storedStates: null,
		savedStates:  null,

		queues: null,


		// ====================================================================
		// IE Bug Fix
		stateChanged:  null,
		doubleChecker: null,

		onUnload: null,

		
		/**
		 * History.clearAllIntervals
		 * Clears all setInterval instances.
		 */
		clearAllIntervals: function(){
			var i, il = this.intervalList;
			if ( typeof il !== "undefined" && il !== null ) {
				for ( i = 0; i < il.length; i++ ) {
					clearInterval( il[i] );
				}
				this.intervalList = null;
			}
		},

		// ====================================================================
		// Debug

		/**
		 * Logs the passed arguments if debug enabled
		 */
		debug: function(){
			if ( ( this.options.debug || false ) ) {
				JX.log.apply( History, arguments );
			}
		},


		// ====================================================================
		// Emulated Status

		/**
		 * this.getInternetExplorerMajorVersion()
		 * Get's the major version of Internet Explorer
		 * @return {integer}
		 * @license Public Domain
		 * @author Benjamin Arthur Lupton <contact@balupton.com>
		 * @author James Padolsey <https://gist.github.com/527683>
		 * An explanation has been provided by paulirish at <https://gist.github.com/527683#gistcomment-7599>
		 */
		getInternetExplorerMajorVersion: function(){
			var result = this.getInternetExplorerMajorVersion.cached =
					( typeof this.getInternetExplorerMajorVersion.cached !== 'undefined' ) ?
						this.getInternetExplorerMajorVersion.cached :
						(function(){
							var v = 3,
									div = this.document.createElement('div'),
									all = div.getElementsByTagName('i');
							while ( ( div.innerHTML = '<!--[if gt IE ' + ( ++v ) + ']><i></i><![endif]-->' ) && all[0] ) {}
							return ( v > 4 ) ? v : false;
						})()
				;
			return result;
		},


		/**
		 * this.isInternetExplorer()
		 * Are we using Internet Explorer?
		 * @return {boolean}
		 * @license Public Domain
		 * @author Benjamin Arthur Lupton <contact@balupton.com>
		 */
		isInternetExplorer: function(){
			var result =
				this.isInternetExplorer.cached =
				( typeof this.isInternetExplorer.cached !== 'undefined' ) ?
						this.isInternetExplorer.cached :
						Boolean( this.getInternetExplorerMajorVersion() )
				;
			return result;
		},


		/**
		 * this.isEmptyObject(obj)
		 * Checks to see if the Object is Empty
		 * @param {Object} obj
		 * @return {boolean}
		 */
		isEmptyObject: function(obj) {
			for ( var name in obj ) {
				return false;
			}
			return true;
		},

		/**
		 * this.cloneObject(obj)
		 * Clones a object and eliminate all references to the original contexts
		 * @param {Object} obj
		 * @return {Object}
		 */
		cloneObject: function( obj ) {
			var hash,newObj;
			if ( obj ) {
				hash = JX.JSON.stringify( obj );
				newObj = JX.JSON.parse( hash );
			}
			else {
				newObj = {};
			}
			return newObj;
		},


		// ====================================================================
		// URL Helpers
		// TODO - must see if these will be useful enough to include in JX core or moved as statics

		/**
		 * this.getRootUrl()
		 * Turns "http://mysite.com/dir/page.html?asd" into "http://mysite.com"
		 * @return {String} rootUrl
		 */
		getRootUrl: function(){
			// Create
			var rootUrl = this.document.location.protocol + '//' + ( this.document.location.hostname || this.document.location.host );
			if ( this.document.location.port || false ) {
				rootUrl += ':'+ this.document.location.port;
			}
			rootUrl += '/';

			// Return
			return rootUrl;
		},

		/**
		 * this.getBaseHref()
		 * Fetches the `href` attribute of the `<base href="...">` element if it exists
		 * @return {String} baseHref
		 */
		getBaseHref: function(){
			// Create
			var
				baseElements = this.document.getElementsByTagName('base'),
				baseElement = null,
				baseHref = '';

			// Test for Base Element
			if ( baseElements.length === 1 ) {
				// Prepare for Base Element
				baseElement = baseElements[0];
				baseHref = baseElement.href.replace(/[^\/]+$/,'');
			}

			// Adjust trailing slash
			baseHref = baseHref.replace(/\/+$/,'');
			if ( baseHref ) baseHref += '/';

			// Return
			return baseHref;
		},

		/**
		 * this.getBaseUrl()
		 * Fetches the baseHref or basePageUrl or rootUrl (whichever one exists first)
		 * @return {String} baseUrl
		 */
		getBaseUrl: function(){
			// Create
			var baseUrl = this.getBaseHref() || this.getBasePageUrl() || this.getRootUrl();

			// Return
			return baseUrl;
		},

		/**
		 * this.getPageUrl()
		 * Fetches the URL of the current page
		 * @return {String} pageUrl
		 */
		getPageUrl: function(){
			// Fetch
			var
				State = this.getState( false, false ),
				stateUrl = ( State || {} ).url || this.document.location.href,
				pageUrl;

			// Create
			pageUrl = stateUrl.replace(/\/+$/,'').replace(/[^\/]+$/,function( part,index,string ){
				return (/\./).test( part ) ? part : part + '/';
			});

			// Return
			return pageUrl;
		},

		/**
		 * this.getBasePageUrl()
		 * Fetches the Url of the directory of the current page
		 * @return {String} basePageUrl
		 */
		getBasePageUrl: function(){
			// Create
			var basePageUrl = this.document.location.href.replace(/[#\?].*/,'').replace(/[^\/]+$/,function(part,index,string){
				return (/[^\/]$/).test(part) ? '' : part;
			}).replace(/\/+$/,'')+'/';

			// Return
			return basePageUrl;
		},

		/**
		 * this.getFullUrl(url)
		 * Ensures that we have an absolute URL and not a relative URL
		 * @param {string} url
		 * @param {Boolean} allowBaseHref
		 * @return {string} fullUrl
		 */
		getFullUrl: function( url, allowBaseHref ){
			// Prepare
			var fullUrl = url, firstChar = url.substring( 0, 1 );
			allowBaseHref = ( typeof allowBaseHref === 'undefined' ) ? true : allowBaseHref;

			// Check
			if ( /[a-z]+\:\/\//.test( url ) ) {
				// Full URL
			}
			else if ( firstChar === '/' ) {
				// Root URL
				fullUrl = this.getRootUrl() + url.replace(/^\/+/,'');
			}
			else if ( firstChar === '#' ) {
				// Anchor URL
				fullUrl = this.getPageUrl().replace(/#.*/,'') + url;
			}
			else if ( firstChar === '?' ) {
				// Query URL
				fullUrl = this.getPageUrl().replace(/[\?#].*/,'') + url;
			}
			else {
				// Relative URL
				if ( allowBaseHref ) {
					fullUrl = this.getBaseUrl() + url.replace(/^(\.\/)+/,'');
				} else {
					fullUrl = this.getBasePageUrl() + url.replace(/^(\.\/)+/,'');
				}
				// We have an if condition above as we do not want hashes
				// which are relative to the baseHref in our URLs
				// as if the baseHref changes, then all our bookmarks
				// would now point to different locations
				// whereas the basePageUrl will always stay the same
			}

			// Return
			return fullUrl.replace(/\#$/,'');
		},

		/**
		 * this.getShortUrl(url)
		 * Ensures that we have a relative URL and not a absolute URL
		 * @param {string} url
		 * @return {string} url
		 */
		getShortUrl: function( url ){
			// Prepare
			var shortUrl = url, baseUrl = this.getBaseUrl(), rootUrl = this.getRootUrl();

			// Trim baseUrl
			if ( this.emulated.pushState ) {
				// We are in a if statement as when pushState is not emulated
				// The actual url these short urls are relative to can change
				// So within the same session, we the url may end up somewhere different
				shortUrl = shortUrl.replace( baseUrl, '' );
			}

			// Trim rootUrl
			shortUrl = shortUrl.replace( rootUrl, '/');

			// Ensure we can still detect it as a state
			if ( this.isTraditionalAnchor( shortUrl ) ) {
				shortUrl = './' + shortUrl;
			}

			// Clean It
			shortUrl = shortUrl.replace(/^(\.\/)+/g,'./').replace(/\#$/,'');

			// Return
			return shortUrl;
		},

		/**
		 * this.noramlizeStore()
		 * Noramlize the store by adding necessary values
		 */
		normalizeStore: function(){
			this.store.idToState = this.store.idToState || {};
			this.store.urlToId   = this.store.urlToId   || {};
			this.store.stateToId = this.store.stateToId || {};
		},


		/**
		 * this.getState()
		 * Get an object containing the data, title and url of the current state
		 * @param {Boolean} friendly
		 * @param {Boolean} create
		 * @return {Object} State
		 */
		getState: function( friendly, create ){
			// Prepare
			if ( typeof friendly === 'undefined' ) { friendly = true; }
			if ( typeof create === 'undefined' ) { create = true; }

			// Fetch
			var State = this.getLastSavedState();

			// Create
			if ( !State && create ) {
				State = this.createStateObject();
			}

			// Adjust
			if ( friendly ) {
				State = this.cloneObject( State );
				State.url = State.cleanUrl || State.url;
			}

			// Return
			return State;
		},


		/**
		 * this.getIdByState(State)
		 * Gets a ID for a State
		 * @param {State} newState
		 * @return {String} id
		 */
		getIdByState: function( newState ){

			// Fetch ID
			var id = this.extractId( newState.url ),
				str;
			
			if ( !id ) {
				// Find ID via State String
				str = this.getStateString( newState );
				if ( typeof this.stateToId[ str ] !== 'undefined' ) {
					id = this.stateToId[ str ];
				}
				else if ( typeof this.store.stateToId[str] !== 'undefined' ) {
					id = this.store.stateToId[ str ];
				}
				else {
					// Generate a new ID
					while ( true ) {
						id = ( new Date() ).getTime() + String( Math.random() ).replace(/\D/g,'');
						if ( typeof this.idToState[ id ] === 'undefined' && typeof this.store.idToState[ id ] === 'undefined' ) {
							break;
						}
					}

					// Apply the new State to the ID
					this.stateToId[ str ] = id;
					this.idToState[ id ]  = newState;
				}
			}

			// Return ID
			return id;
		},


		/**
		 * this.normalizeState(State)
		 * Expands a State Object
		 * @param {object} State
		 * @return {object}
		 */
		normalizeState: function( oldState ){
			// Variables
			var newState, dataNotEmpty;

			// Prepare
			if ( !oldState || ( typeof oldState !== 'object' ) ) {
				oldState = {};
			}

			// Check
			if ( typeof oldState.normalized !== 'undefined' ) {
				return oldState;
			}

			// Adjust
			if ( !oldState.data || ( typeof oldState.data !== 'object' ) ) {
				oldState.data = {};
			}

			// ----------------------------------------------------------------

			// Create
			newState            = {};
			newState.normalized = true;
			newState.title      = oldState.title || '';
			newState.url        = this.getFullUrl( this.unescapeString( oldState.url || this.document.location.href ) );
			newState.hash       = this.getShortUrl( newState.url );
			newState.data       = this.cloneObject( oldState.data );

			// Fetch ID
			newState.id = this.getIdByState( newState );

			// ----------------------------------------------------------------

			// Clean the URL
			newState.cleanUrl = newState.url.replace(/\??\&_suid.*/,'');
			newState.url = newState.cleanUrl;

			// Check to see if we have more than just a url
			dataNotEmpty = !this.isEmptyObject( newState.data );

			// Apply
			if ( newState.title || dataNotEmpty ) {
				// Add ID to Hash
				newState.hash = this.getShortUrl( newState.url ).replace(/\??\&_suid.*/,'');
				if ( !/\?/.test( newState.hash ) ) {
					newState.hash += '?';
				}
				newState.hash += '&_suid=' + newState.id;
			}

			// Create the Hashed URL
			newState.hashedUrl = this.getFullUrl( newState.hash );

			// ----------------------------------------------------------------

			// Update the URL if we have a duplicate
			if ( ( this.emulated.pushState || this.bugs.safariPoll ) && this.hasUrlDuplicate( newState ) ) {
				newState.url = newState.hashedUrl;
			}

			// ----------------------------------------------------------------

			// Return
			return newState;
		},

		/**
		 * this.createStateObject(data,title,url)
		 * Creates a object based on the data, title and url state params
		 * @param {object} data
		 * @param {string} title
		 * @param {string} url
		 * @return {object}
		 */
		createStateObject: function( data, title, url ){
			// Hashify
			var State = {
				'data':  data,
				'title': title,
				'url':   url
			};

			// Expand the State
			State = this.normalizeState( State );

			// Return object
			return State;
		},


		/**
		 * this.getStateById(id)
		 * Get a state by it's UID
		 * @param {String} id
		 */
		getStateById: function( id ){
			// Prepare
			id = String( id );

			// Retrieve
			var State = this.idToState[ id ] || this.store.idToState[ id ] || undefined;

			// Return State
			return State;
		},

		/**
		 * Get a State's String
		 * @param {State} passedState
		 */
		getStateString: function( passedState ){
			// Prepare
			var State, cleanedState, str;

			// Fetch
			State = this.normalizeState( passedState );

			// Clean
			cleanedState = {
				data:  State.data,
				title: passedState.title,
				url:   passedState.url
			};

			// Fetch
			str = JX.JSON.stringify( cleanedState );

			// Return
			return str;
		},


		/**
		 * Get a State's ID
		 * @param {State} passedState
		 * @return {String} id
		 */
		getStateId: function( passedState ){
			// Prepare
			var State, id;
			
			// Fetch
			State = this.normalizeState( passedState );

			// Fetch
			id = State.id;

			// Return
			return id;
		},


		/**
		 * this.getIdByUrl()
		 * Get a State ID by a State URL
		 */
		getIdByUrl: function( url ){
			// Fetch
			var id = this.urlToId[ url ] || this.store.urlToId[ url ] || undefined;

			// Return
			return id;
		},


		/**
		 * this.getHashByState(State)
		 * Creates a Hash for the State Object
		 * @param {State} passedState
		 * @return {String} hash
		 */
		getHashByState: function( passedState ){
			// Prepare
			var State, hash;
			
			// Fetch
			State = this.normalizeState( passedState );

			// Hash
			hash = State.hash;

			// Return
			return hash;
		},


		/**
		 * this.getLastSavedState()
		 * Get an object containing the data, title and url of the current state
		 * @return {Object} State
		 */
		getLastSavedState: function(){
			return this.savedStates[ this.savedStates.length - 1 ] || undefined;
		},

		/**
		 * this.getLastStoredState()
		 * Get an object containing the data, title and url of the current state
		 * @return {Object} State
		 */
		getLastStoredState: function(){
			return this.storedStates[ this.storedStates.length - 1 ] || undefined;
		},


		/**
		 * this.getStateByIndex()
		 * Gets a state by the index
		 * @param {integer} index
		 * @return {Object}
		 */
		getStateByIndex: function( index ){
			// Prepare
			var State = null;

			// Handle
			if ( typeof index === 'undefined' ) {
				// Get the last inserted
				State = this.savedStates[ this.savedStates.length - 1 ];
			}
			else if ( index < 0 ) {
				// Get from the end
				State = this.savedStates[ this.savedStates.length + index ];
			}
			else {
				// Get from the beginning
				State = this.savedStates[ index ];
			}

			// Return State
			return State;
		},

		/**
		 * this.extractId(url_or_hash)
		 * Get a State ID by it's URL or Hash
		 * @param {string} url_or_hash
		 * @return {string} id
		 */
		extractId: function ( url_or_hash ) {
			// Prepare
			var id, parts, url;

			// Extract
			parts = /(.*)\&_suid=([0-9]+)$/.exec( url_or_hash );
			url = parts ? ( parts[1] || url_or_hash ) : url_or_hash;
			id = parts ? String( parts[2] || '' ) : '';

			// Return
			return id || false;
		},


		/**
		 * this.isTraditionalAnchor
		 * Checks to see if the url is a traditional anchor or not
		 * @param {String} url_or_hash
		 * @return {Boolean}
		 */
		isTraditionalAnchor: function( url_or_hash ){
			// Check
			var isTraditional = !( /[\/\?\.]/.test( url_or_hash ) );

			// Return
			return isTraditional;
		},


		/**
		 * this.extractState
		 * Get a State by it's URL or Hash
		 * @param {String} url_or_hash
		 * @return {State|null}
		 */
		extractState: function( url_or_hash, create ){
			// Prepare
			var State = null, id, url;
			create = create || false;

			// Fetch SUID
			id = this.extractId( url_or_hash );
			if ( id ) {
				State = this.getStateById( id );
			}

			// Fetch SUID returned no State
			if ( !State ) {
				// Fetch URL
				url = this.getFullUrl( url_or_hash );

				// Check URL
				id = this.getIdByUrl( url ) || false;
				if ( id ) {
					State = this.getStateById( id );
				}

				// Create State
				if ( !State && create && !this.isTraditionalAnchor( url_or_hash ) ) {
					State = this.createStateObject( null, null, url );
				}
			}

			// Return
			return State;
		},


		/**
		 * this.hasUrlDuplicate
		 * Checks if a Url will have a url conflict
		 * @param {Object} newState
		 * @return {Boolean} hasDuplicate
		 */
		hasUrlDuplicate: function( newState ) {
			// Prepare
			var hasDuplicate = false,
				oldState;

			// Fetch
			oldState = this.extractState( newState.url );

			// Check
			hasDuplicate = oldState && oldState.id !== newState.id;

			// Return
			return hasDuplicate;
		},

		/**
		 * this.storeState
		 * Store a State
		 * @param {Object} newState
		 * @return {Object} newState
		 */
		storeState: function( newState ){
			// Store the State
			this.urlToId[ newState.url ] = newState.id;

			// Push the State
			this.storedStates.push( this.cloneObject( newState ) ); 

			// Return newState
			return newState;
		},

		/**
		 * this.isLastSavedState(newState)
		 * Tests to see if the state is the last state
		 * @param {Object} newState
		 * @return {boolean} isLast
		 */
		isLastSavedState: function( newState ){
			// Prepare
			var isLast = false,
				newId, oldState, oldId;

			// Check
			if ( this.savedStates.length ) {
				newId = newState.id;
				oldState = this.getLastSavedState();
				oldId = oldState.id;

				// Check
				isLast = (newId === oldId);
			}

			// Return
			return isLast;
		},


		/**
		 * this.saveState
		 * Push a State
		 * @param {Object} newState
		 * @return {boolean} changed
		 */
		saveState: function( newState ){
			// Check Hash
			if ( this.isLastSavedState( newState ) ) {
				return false;
			}

			// Push the State
			this.savedStates.push( this.cloneObject( newState ) );

			// Return true
			return true;
		},


		// ====================================================================
		// Hash Helpers

		/**
		 * this.getHash()
		 * Gets the current document hash
		 * @return {string}
		 */
		getHash: function(){
			var hash = this.unescapeHash( this.document.location.hash );
			return hash;
		},


		/**
		 * this.unescapeString()
		 * Unescape a string
		 * @param {String} str
		 * @return {string}
		 */
		unescapeString: function( str ){
			// Prepare
			var result = str,
				tmp;

			// Unescape hash
			while ( true ) {
				tmp = window.unescape( result );
				if ( tmp === result ) {
					break;
				}
				result = tmp;
			}

			// Return result
			return result;
		},


		/**
		 * this.unescapeHash()
		 * normalize and Unescape a Hash
		 * @param {String} hash
		 * @return {string}
		 */
		unescapeHash: function( hash ){
			// Prepare
			var result = this.normalizeHash( hash );

			// Unescape hash
			result = this.unescapeString( result );

			// Return result
			return result;
		},


		/**
		 * this.normalizeHash()
		 * normalize a hash across browsers
		 * @return {string}
		 */
		normalizeHash: function( hash ){
			// Prepare
			var result = hash.replace(/[^#]*#/,'').replace(/#.*/, '');

			// Return result
			return result;
		},


		/**
		 * this.setHash(hash)
		 * Sets the document hash
		 * @param {string} hash
		 * @return {History}
		 */
		setHash: function( hash, queue ){
			// Prepare
			var adjustedHash, State, pageUrl;

			// Handle Queueing
			if ( queue !== false && this.busy() ) {
				// Wait + Push to Queue
				// this.debug( 'setHash: we must wait', arguments );
				this.pushQueue({
					scope: this,
					callback: this.setHash,
					args: arguments,
					queue: queue
				});
				return false;
			}

			// Log
			// this.debug('setHash: called',hash);

			// Prepare
			adjustedHash = this.escapeHash( hash );

			// Make Busy + Continue
			this.busy( true );

			// Check if hash is a state
			State = this.extractState( hash, true );
			if ( State && !this.emulated.pushState ) {
				// Hash is a state so skip the setHash
				// this.debug( 'setHash: Hash is a state so skipping the hash set with a direct pushState call',arguments );

				// PushState
				this.pushState( State.data, State.title, State.url, false );
			}
			else if ( this.document.location.hash !== adjustedHash ) {
				// Hash is a proper hash, so apply it

				// Handle browser bugs
				if ( this.bugs.setHash ) {
					// Fix Safari Bug https://bugs.webkit.org/show_bug.cgi?id=56249

					// Fetch the base page
					pageUrl = this.getPageUrl();

					// Safari hash apply
					this.pushState( null, null, pageUrl + '#' + adjustedHash, false );
				}
				else {
					// Normal hash apply
					this.document.location.hash = adjustedHash;
				}
			}

			// Chain
			return this;
		},


		/**
		 * this.escape()
		 * normalize and Escape a Hash
		 * @return {string}
		 */
		escapeHash: function( hash ){
			// Prepare
			var result = this.normalizeHash( hash );

			// Escape hash
			result = window.escape( result );

			// IE6 Escape Bug
			if ( !this.bugs.hashEscape ) {
				// Restore common parts
				result = result
					.replace(/\%21/g,'!')
					.replace(/\%26/g,'&')
					.replace(/\%3D/g,'=')
					.replace(/\%3F/g,'?');
			}

			// Return result
			return result;
		},


		/**
		 * this.getHashByUrl(url)
		 * Extracts the Hash from a URL
		 * @param {string} url
		 * @return {string} url
		 */
		getHashByUrl: function( url ){
			// Extract the hash
			var hash = String( url )
				.replace(/([^#]*)#?([^#]*)#?(.*)/, '$2')
				;

			// Unescape hash
			hash = this.unescapeHash( hash );

			// Return hash
			return hash;
		},


		/**
		 * this.setTitle(title)
		 * Applies the title to the document
		 * @param {State} newState
		 * @return {Boolean}
		 */
		setTitle: function( newState ){
			// Prepare
			var title = newState.title,
				firstState;

			// Initial
			if ( !title ) {
				firstState = this.getStateByIndex(0);
				if ( firstState && firstState.url === newState.url ) {
					title = firstState.title || this.options.initialTitle;
				}
			}

			// Apply
			try {
				this.document.getElementsByTagName('title')[0].innerHTML = title.replace('<','&lt;').replace('>','&gt;').replace(' & ',' &amp; ');
			}
			catch ( Exception ) { }
			this.document.title = title;

			// Chain
			return this;
		},


		// ====================================================================
		// Queueing

		/**
		 * this.busy(value)
		 * @param {boolean} value [optional]
		 * @return {boolean} busy
		 */
		busy: function( value ){
			// Apply
			if ( typeof value !== 'undefined' ) {
				// this.debug( 'busy: changing [' + ( this.busy.flag || false ) + '] to [' + ( value || false ) + ']', this.queues.length);
				this.busy.flag = value;
			}
			// Default
			else if ( typeof this.busy.flag === 'undefined' ) {
				this.busy.flag = false;
			}

			// Queue
			if ( !this.busy.flag ) {
				// Execute the next item in the queue
				clearTimeout( this.busy.timeout );
				var fireNext = JX.bind( this, function(){
					var i, queue, item;
					if ( this.busy.flag ) return;
					for ( i = this.queues.length - 1; i >= 0; --i ) {
						queue = this.queues[i];
						if ( queue.length === 0 ) continue;
						item = queue.shift();
						this.fireQueueItem( item );
						this.busy.timeout = setTimeout( JX.bind( this, fireNext ), this.options.busyDelay );
					}
				});
				this.busy.timeout = setTimeout( JX.bind( this, fireNext ), this.options.busyDelay );
			}

			// Return
			return this.busy.flag;
		},

		/**
		 * this.fireQueueItem(item)
		 * Fire a Queue Item
		 * @param {Object} item
		 * @return {Mixed} result
		 */
		fireQueueItem: function( item ){
			return item.callback.apply( item.scope || this, item.args || [] );
		},


		/**
		 * this.pushQueue(callback,args)
		 * Add an item to the queue
		 * @param {Object} item [scope,callback,args,queue]
		 */
		pushQueue: function( item ){
			// Prepare the queue
			this.queues[ item.queue || 0 ] = this.queues[ item.queue || 0 ] || [];

			// Add to the queue
			this.queues[ item.queue || 0 ].push( item );

			// Chain
			return this;
		},


		/**
		 * this.queue (item,queue), (func,queue), (func), (item)
		 * Either firs the item now if not busy, or adds it to the queue
		 */
		queue: function( item, queue ){
			// Prepare
			if ( typeof item === 'function' ) {
				item = {
					callback: item
				};
			}
			if ( typeof queue !== 'undefined' ) {
				item.queue = queue;
			}

			// Handle
			if ( this.busy() ) {
				this.pushQueue( item );
			} else {
				this.fireQueueItem( item );
			}

			// Chain
			return this;
		},


		/**
		 * this.clearQueue()
		 * Clears the Queue
		 */
		clearQueue: function(){
			this.busy.flag = false;
			this.queues = [];
			return this;
		},


		// ====================================================================
		// IE Bug Fix

		/**
		 * this.doubleCheckComplete()
		 * Complete a double check
		 * @return {History}
		 */
		doubleCheckComplete: function(){
			// Update
			this.stateChanged = true;

			// Clear
			this.doubleCheckClear();

			// Chain
			return this;
		},

		/**
		 * this.doubleCheckClear()
		 * Clear a double check
		 * @return {History}
		 */
		doubleCheckClear: function(){
			// Clear
			if ( this.doubleChecker ) {
				clearTimeout( this.doubleChecker );
				this.doubleChecker = false;
			}

			// Chain
			return this;
		},

		/**
		 * this.doubleCheck()
		 * Create a double check
		 * @return {History}
		 */
		doubleCheck: function( tryAgain ){
			// Reset
			this.stateChanged = false;
			this.doubleCheckClear();

			// Fix IE6,IE7 bug where calling history.back or history.forward does not actually change the hash (whereas doing it manually does)
			// Fix Safari 5 bug where sometimes the state does not change: https://bugs.webkit.org/show_bug.cgi?id=42940
			if ( this.bugs.ieDoubleCheck ) {
				// Apply Check
				this.doubleChecker = setTimeout(
					JX.bind( this, function(){
						this.doubleCheckClear();
						if ( !this.stateChanged ) {
							// this.debug('History.doubleCheck: State has not yet changed, trying again', arguments);
							// Re-Attempt
							tryAgain();
						}
						return true;
					}),
					this.options.doubleCheckInterval
				);
			}

			// Chain
			return this;
		},

		// ====================================================================
		// Safari Bug Fix

		/**
		 * this.safariStatePoll()
		 * Poll the current state
		 * @return {History}
		 */
		safariStatePoll: function(){
			// Poll the URL

			// Get the Last State which has the new URL
			var
				urlState = this.extractState( this.document.location.href ),
				newState;

			// Check for a difference
			if ( !this.isLastSavedState( urlState ) ) {
				newState = urlState;
			}
			else {
				return;
			}

			// Check if we have a state with that url
			// If not create it
			if ( !newState ) {
				// this.debug('History.safariStatePoll: new');
				newState = this.createStateObject();
			}

			// Apply the New State
			//this.debug('History.safariStatePoll: trigger');
			JX.Stratcom.trigger( "popstate" );
			//this.Adapter.trigger(window,'popstate');

			// Chain
			return this;
		},


		// ====================================================================
		// State Aliases

		/**
		 * this.back(queue)
		 * Send the browser history back one item
		 * @param {Integer} queue [optional]
		 */
		back: function( queue ){
			// this.debug( 'History.back: called', arguments);

			// Handle Queueing
			if ( queue !== false && this.busy() ) {
				// Wait + Push to Queue
				// this.debug('History.back: we must wait', arguments);
				this.pushQueue({
					scope: this,
					callback: this.back,
					args: arguments,
					queue: queue
				});
				return false;
			}

			// Make Busy + Continue
			this.busy(true);

			// Fix certain browser bugs that prevent the state from changing
			this.doubleCheck( JX.bind( this, function(){
				this.back( false );
			}));

			// Go back
			this.history.go( -1 );

			// End back closure
			return true;
		},


		/**
		 * this.forward(queue)
		 * Send the browser history forward one item
		 * @param {Integer} queue [optional]
		 */
		forward: function( queue ){
			// this.debug('History.forward: called', arguments);

			// Handle Queueing
			if ( queue !== false && this.busy() ) {
				// Wait + Push to Queue
				// this.debug('History.forward: we must wait', arguments);
				this.pushQueue({
					scope: this,
					callback: this.forward,
					args: arguments,
					queue: queue
				});
				return false;
			}

			// Make Busy + Continue
			this.busy( true );

			// Fix certain browser bugs that prevent the state from changing
			this.doubleCheck( JX.bind( this, function(){
				this.forward( false );
			}));

			// Go forward
			this.history.go( 1 );

			// End forward closure
			return true;
		},


		/**
		 * this.go(index,queue)
		 * Send the browser history back or forward index times
		 * @param {Integer} queue [optional]
		 */
		go: function( index, queue ){
			// this.debug('History.go: called', arguments);

			// Prepare
			var i;

			// Handle
			if ( index > 0 ) {
				// Forward
				for ( i=1; i<=index; ++i ) {
					this.forward(queue);
				}
			}
			else if ( index < 0 ) {
				// Backward
				for ( i=-1; i>=index; --i ) {
					this.back( queue );
				}
			}
			else {
				throw new Error('History.go: History.go requires a positive or negative integer passed.');
			}

			// Chain
			return this;
		},



		// ====================================================================
		// HTML5 State Support

		/*
		 * Use native HTML5 History API Implementation
		 */

		/**
		 * this.onPopState(event,extra)
		 * Refresh the Current State
		 */
		onPopState: function( event, extra ){
			// Prepare
			var stateId = false, newState = false, currentHash, currentState;

			// Reset the double check
			this.doubleCheckComplete();

			// Check for a Hash, and handle appropriately
			currentHash	= this.getHash();
			if ( currentHash ) {
				// Expand Hash
				currentState = this.extractState( currentHash || this.document.location.href, true );
				if ( currentState ) {
					// We were able to parse it, it must be a State!
					// Let's forward to replaceState
					// this.debug('History.onPopState: state anchor', currentHash, currentState);
					this.replaceState( currentState.data, currentState.title, currentState.url, false );
				}
				else {
					// Traditional Anchor
					// this.debug('History.onPopState: traditional anchor', currentHash);

					JX.Stratcom.trigger( 'anchorchange' )
					//this.Adapter.trigger(window,'anchorchange');
					this.busy( false );
				}

				// We don't care for hashes
				this.expectedStateId = false;
				return false;
			}

			// Ensure
			stateId = this.Adapter.extractEventData( 'state', event, extra ) || false;

			// Fetch State
			if ( stateId ) {
				// Vanilla: Back/forward button was used
				newState = this.getStateById( stateId );
			}
			else if ( this.expectedStateId ) {
				// Vanilla: A new state was pushed, and popstate was called manually
				newState = this.getStateById( this.expectedStateId );
			}
			else {
				// Initial State
				newState = this.extractState( this.document.location.href );
			}

			// The State did not exist in our store
			if ( !newState ) {
				// Regenerate the State
				newState = this.createStateObject( null, null, this.document.location.href );
			}

			// Clean
			this.expectedStateId = false;

			// Check if we are the same state
			if ( this.isLastSavedState( newState ) ) {
				// There has been no change (just the page's hash has finally propagated)
				// this.debug('History.onPopState: no change', newState, this.savedStates);
				this.busy( false );
				return false;
			}

			// Store the State
			this.storeState( newState );
			this.saveState( newState );

			// Force update of the title
			this.setTitle( newState );

			// Fire Our Event
			this.invoke( 'statechange' );
			//this.Adapter.trigger( window,'statechange' );
			this.busy( false );

			// Return true
			return true;
		},
		

		/**
		 * this.pushState(data,title,url)
		 * Add a new State to the history object, become it, and trigger onpopstate
		 * We have to trigger for HTML4 compatibility
		 * @param {object} data
		 * @param {string} title
		 * @param {string} url
		 * @return {true}
		 */
		pushState: function( data, title, url, queue ){
			// this.debug('History.pushState: called', arguments);

			// Check the State
			if ( this.getHashByUrl( url ) && this.emulated.pushState ) {
				throw new Error('History.js does not support states with fragment-identifiers (hashes/anchors).');
			}

			// Handle Queueing
			if ( queue !== false && this.busy() ) {
				// Wait + Push to Queue
				// this.debug('History.pushState: we must wait', arguments);
				this.pushQueue({
					scope: this,
					callback: this.pushState,
					args: arguments,
					queue: queue
				});
				return false;
			}

			// Make Busy + Continue
			this.busy(true);

			// Create the newState
			var newState = this.createStateObject( data, title, url );

			// Check it
			if ( this.isLastSavedState( newState ) ) {
				// Won't be a change
				this.busy( false );
			}
			else {
				// Store the newState
				this.storeState( newState );
				this.expectedStateId = newState.id;

				// Push the newState
				this.history.pushState( newState.id, newState.title, newState.url );

				// Fire HTML5 Event
				JX.Stratcom.invoke( 'popstate' );
				//this.Adapter.trigger( window, 'popstate' );
			}

			// End pushState closure
			return true;
		},

		/**
		 * this.replaceState(data,title,url)
		 * Replace the State and trigger onpopstate
		 * We have to trigger for HTML4 compatibility
		 * @param {object} data
		 * @param {string} title
		 * @param {string} url
		 * @return {true}
		 */
		replaceState: function( data, title, url, queue ){
			// this.debug('History.replaceState: called', arguments);

			// Check the State
			if ( this.getHashByUrl( url ) && this.emulated.pushState ) {
				throw new Error('History.js does not support states with fragement-identifiers (hashes/anchors).');
			}

			// Handle Queueing
			if ( queue !== false && this.busy() ) {
				// Wait + Push to Queue
				//History.debug('History.replaceState: we must wait', arguments);
				this.pushQueue({
					scope: this,
					callback: this.replaceState,
					args: arguments,
					queue: queue
				});
				return false;
			}

			// Make Busy + Continue
			this.busy(true);

			// Create the newState
			var newState = this.createStateObject( data, title, url );

			// Check it
			if ( this.isLastSavedState( newState ) ) {
				// Won't be a change
				this.busy( false );
			}
			else {
				// Store the newState
				this.storeState( newState );
				this.expectedStateId = newState.id;

				// Push the newState
				this.history.replaceState( newState.id, newState.title, newState.url );

				// Fire HTML5 Event
				JX.Stratcom.invoke( 'popstate' );
				//this.Adapter.trigger( window, 'popstate' );
			}

			// End replaceState closure
			return true;
		}

	}

});
