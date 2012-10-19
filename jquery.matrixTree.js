/**
* MySource Matrix Simple Edit Tools (jquery.matrixMap.js)
* version: 0.1.1 (DEC-16-2009)
* Copyright (C) 2009 Nicholas Hubbard
* @requires jQuery v1.3 or later
*
* Examples and documentation at: http://www.zedsaid.com/projects/simple-edit-tools
* Dual licensed under the MIT and GPL licenses:
* http://www.opensource.org/licenses/mit-license.php
* http://www.gnu.org/licenses/gpl.html
*
*/

/*
Limitations:
	use me - the context menu we've chosen only allows one trigger, so we've
		used two context maps to be triggered by different means


TODO

	click the plus to expand/contract the tree

	fire some events so we can start things sanely, like the polling

	figure out where not_accessible.png is used asset_map.inc:470
		'parameter.url.notaccessibleicon'	=> 'asset_map/not_accessible.png',
		'parameter.url.type2icon'			=> 'asset_map/not_visible.png',

	consistency
		sometimes we're passing around raw DOM, other times jQuery object
		sometimes we're passing around a.asset_name other times an li

	icon for expansion of bottom tree node (or replace the tree)

*/

var init;

// allow the asset finder to work
//var SQ_DOCUMENT_LOADED = false;


(function ($, undefined) {

// constants
STATUS_CONSTRUCTION = '2';
STATUS_LIVE = '16';

// modes
MODE_NORMAL = 1;
MODE_MOVE = 2;
MODE_CLONE = 3;
MODE_LINK = 4;
MODE_SELECT = 5;
MODE_USEME = 6;

/*
$(document).ready(function() {
	// allow the asset finder to work
	SQ_DOCUMENT_LOADED = true;
});
*/

var buildContextMenus = function buildContextMenus() {

	// commonly used for context menus
	// In all context menus on the tree we're going to try to target the
	// LI element for the tree node as it contains all relevant information
	// for that asset (and tree behaviour)
	$.extend($.contextMenu.defaults, {
		events: {
			show: function(options) {
//console.log('show.this', this);
//console.log('show.args', arguments);
				// store the node that was clicked
				options.$target = this.closest('li');
console.log('options.$target', options);
			},
			hide: function(options) {
				// this is called in addition to the command callback
				// so in the command callback we unset the target to
				// indicate our work is done, otherwise we want to keep the
				// mode the same
				if (!options.$target) {
console.log('context menu hide changing map mode from', $map.mode.current);
					$map.mode.change(1);
				}
			}
		},
		// bumping this up to cover the "hidden" (type_2 link) asset icon
		zIndex: 2
	});

	// context menu for move/link/clone
//	$map.menuSelectors['select'] = $map.selector + ' .asset_name.selectable';
	$map.menuSelectors['select'] = $map.selector + ' li.jstree-leaf';
	$.contextMenu({
		selector: $map.menuSelectors['select'],
		trigger: 'none',
		disabled: true,
		events: {
//			hide: $.noop // override the default above
			hide: function(options) {
				$map.mode.change(MODE_NORMAL);
			}
		},
		callback: function(key, options) {
console.log('stuff to do stuff with');
console.log($map.dnd_info);
			var t = $.jstree._reference($map.selector);
console.log('info', t.data.dnd);
		},
		items: {
			move: {
				name: $matrix.util.translate('asset_map_menu_move_here'),
//				callback: function(key, options) {
//					if (!(options.$target && $map.selected.length)) {
//						alert($matrix.util.translate('asset_map_error_invalid_node'));
//						return;
//					}
//
//					$matrix.backend.moveAssets($map.selected, options.$target);
//				}
			},
			newlink: {
				name: $matrix.util.translate('asset_map_menu_link_here'),
//				callback: function(key, options) {
//					if (!(options.$target && $map.selected.length)) {
//						alert($matrix.util.translate('asset_map_error_invalid_node'));
//						return;
//					}
//
//					$matrix.backend.linkAssets($map.selected, options.$target);
//				}
			},
			clone: {
				name: $matrix.util.translate('asset_map_menu_clone_here'),
				disabled: true,
//				callback: function(key, options) {
//					if (!(options.$target && $map.selected.length)) {
//						alert($matrix.util.translate('asset_map_error_invalid_node'));
//						return;
//					}
//
//					$matrix.backend.cloneAssets($map.selected, options.$target);
//				}
			},
			sep: '-',
			cancel: {
				name: $matrix.util.translate('asset_map_menu_cancel'),
				callback: function(key, options) {
//					$map.mode.change(1);
				}
			}
		}
	});


	// common function for useme result
	var usemeItems = {
		useme: {
			name: $matrix.util.translate('asset_map_menu_useme'),
			callback: function usemeCallback(key, options) {
				if (!options.$target) {
					alert('Bad state - no target!');
				}

console.log('selector', options.selector);
console.log('target', options.$target);

				var attrs = options.$target.get(0).attributes;
				// see MatrixTreeNode.java:141
				var getUrl = function(url, webPath) {
					if (url == null) {
						return "";
					} else if (webPath == null) {
						return url;
					}
					return url + "/" + webPath;
				}

				// using setTimeout to uncouple things - may not be necessary
				setTimeout(function() {
					// see MatrixMenus.java:205
					asset_finder_done(
						attrs.getNamedItem('assetid').value,
						attrs.getNamedItem('name').value,
						// TODO this is still wrong
						// I have no idea how this is working
						// the java version responds with a path of "/" for asset that had no previous URL
//						getUrl(attrs.getNamedItem('url').value, attrs.getNamedItem('web_path').value),
						attrs.getNamedItem('url').value,
						attrs.getNamedItem('linkid').value
					);
				}, 100);

				// this indicates to the context menus hide method that
				// we've achieved our goal
				delete(options.$target);
			}
		}
	};


	// context menu for useme via left click
	$map.menuSelectors['useme-li'] = $map.selector + ' li';
	$.contextMenu({
		// TODO need to allow expansion when this is active
		selector: $map.menuSelectors['useme-li'],
		trigger: 'right',
		disabled: true,
		events: {
			show: function(options) { // override the default above
				// store the node that was clicked (jQuery)
				options.$target = this;
			}
		},
		items: usemeItems
	});

	// context menu for useme via left click
	$map.menuSelectors['useme-name'] = $map.selector + ' a.asset_name';
	$.contextMenu({
		// TODO need to allow expansion when this is active
		selector: $map.menuSelectors['useme-name'],
		trigger: 'right',
		disabled: true,
		items: usemeItems
	});
};



$.fn.matrix = {
	map: {
		debug: true,
		// TODO supply these from PHP
		params: {
			// see AssetMap.java:246
			refreshInterval: 2000, // milliseconds
			adminSuffix: '_admin/', // don't fuck this up, xhr doesn't follow redirects
			fetchLimit: 150,
			lib: '__lib'
		},
		// TODO get this from elsewhere
		locale: 'en_AU',
		_id: 'map_root',
		// this is the CSS selector using the map._id
		selector: undefined,
		mode: {
			current: MODE_NORMAL,
			// TODO we're passing the scope on here, so we'd better some up with
			// some rules about how to use it :-/
			change: function(newMode) {
				if (!$map.mode[newMode]) {
					alert('Invalid map mode requested: ' + newMode);
					return;
				}

				if ($map.mode.current === newMode) {
					console.log('LAME! attempt to change to existing mode - fix your code :-P');
					console.trace();
					return;
				}

				if ($map.debug) console.log('exiting mode', $map.mode.current);
				$map.mode[$map.mode.current].exit.call(this);
				$map.mode.current = newMode;
				if ($map.debug) console.log('entering mode', $map.mode.current);
				$map.mode[$map.mode.current].enter.call(this);
			}
		},
		selected: [],
		previousSelected: [],
		// called when selecting something in the map
		// TODO this can be much more efficient
		select: function() {
			if ($.inArray(this, $map.selected) !== -1) {
console.log('already selected', this);
				return;
			}

			// add this item
			$map.selected.push(this);

			$map._redrawSelected();
		},
		// refresh the selected nodes
		_redrawSelected: function() {
			// Remove all colors first
			$($map.selector + ' li a').removeClass('live construction');

			// reset the colors
			$.each($map.selected, function() {
				switch ($(this).attr('status')) {
					case STATUS_LIVE:
						$(this).addClass('live');
					break;
					case STATUS_CONSTRUCTION:
						$(this).addClass('construction');
					break;
					default:
					break;
				}
			})
		},
		// this stores the context menu items for asset typs
		// we're storing the menu details here because they'll be built dynamically
		// and this gives us the flexibility to add/remove types etc without reload
		assetScreens: {},
		// store the selectors for the different menus to accurately enable/disable
		menuSelectors: {},
		// see AssetMap.java:246
		checkRefresh: function checkRefresh() {
			if ($map.debug) console.log('checking for refresh', new Date());
			// TODO we could be anal and check for a string.. meh
			if (SQ_REFRESH_ASSETIDS) {
				refreshAssets(SQ_REFRESH_ASSETIDS.split(/,|\|/));
				SQ_REFRESH_ASSETIDS = '';
			}

			// check again
			setTimeout($map.checkRefresh, $map.params.refreshInterval);
		}
	},
	backend: {
		// TODO work out our path better
		url: location.protocol + '//' + location.host + '/',
		params: {
			SQ_ACTION: 'asset_map_request',
			XDEBUG_SESSION_START: 'netbeans-xdebug'
		},
		getUrl: function getUrl(path, params) {
			return $matrix.backend.url + (path || '') + '?' + $.param($.extend(
				{},
				$matrix.backend.params,
				params || {}
			))
		},
		// TODO make asset an object
		getScreenUrl: function getScreenUrl(screen, asset) {
			// see MatrixMenus.java:147
//				Matrix.getProperty("parameter.url.baseurl") +
//				Matrix.getProperty("parameter.backendsuffix") +
//				"/?SQ_BACKEND_PAGE=main&backend_section=" +
//				"am&am_section=edit_asset&assetid=" + assetid +
//				"&sq_asset_path=" + assetPath + "&sq_link_path=" +
//				linkPath + "&asset_ei_screen=" + screenName;
console.log('asset', asset);

			// TODO get the link path which is a comma separated list of link
			// ids up to the root
			// TODO get the asset path which is a comma separated list of asset
			// ids up to the root

			// TODO get backendsuffix from somewhere
			return $matrix.backend.getUrl($map.params.adminSuffix, {
				SQ_BACKEND_PAGE: 'main',
				backend_secion: 'am',
				am_section: 'edit_asset',
				assetid: asset.attr('assetid'),
				sq_asset_path: asset.attr('path'),
				sq_link_path: asset.attr('linkid'),
				asset_ei_screen: screen,
				SQ_ACTION: null // overwrite this
			});
		},
		// common handler for move/clone/link
		_handleAssets: function _handleAssets(action, assets, $target) {
			var args = $.map(assets, function(asset) {
				var $asset = $(asset);
				return {
					assetid: $asset.attr('assetid'),
					linkid: $asset.attr('linkid'),
					parentid: $asset.attr('parentid')
				};
			});

			$map.mode.change(1);

			$.ajax({
				url: $matrix.backend.getUrl($map.params.adminSuffix),
				type: 'POST',
				processData: false,
				data: $matrix.util.getCommandXML(action, {
					to_parent_assetid: $target.find('a.asset_name').attr('assetid'),
					to_parent_pos: 0 // TODO positional selection
				}, args),
				contentType: "text/xml",
				dataType: 'xml',
				error: function (XMLHttpRequest, textStatus, errorThrown) {
					console.log(XMLHttpRequest, textStatus, errorThrown);
				},
				success: function(xml) {
console.log(xml);
					var url = $(xml).find('url[js_function=asset_map_popup]').text();
					url && open_hipo(url);
				}
			});
		},
		moveAssets: function(assets, $target) {
			$matrix.backend._handleAssets('move asset', assets, $target);
		},
		linkAssets: function(assets, $target) {
			$matrix.backend._handleAssets('new link', assets, $target);
		},
		cloneAssets: function(assets, $target) {
			$matrix.backend._handleAssets('clone', assets, $target);
		},
		// see MatrixTreeComm:61
		createAsset: function(type, $parent, parentPosition) {
			// see MatrixTree.java:1596:1689 for the -1 option
			parentPosition = parentPosition || -1;

			// <command action="get url" cmd="add" parent_assetid="1" pos="6" type_code="folder" />

			$.ajax({
				url: $matrix.backend.getUrl($map.params.adminSuffix),
				type: 'POST',
				processData: false,
				data: $matrix.util.getCommandXML('get url', {
					parent_assetid: $parent.attr('assetid'),
					pos: parentPosition,
					cmd: 'add',
					type_code: type
				}),
				contentType: "text/xml",
				dataType: 'xml',
				error: function (XMLHttpRequest, textStatus, errorThrown) {
					console.log(XMLHttpRequest, textStatus, errorThrown);
				},
				success: function(xml) {
					var url = $(xml).find('url[frame=sq_main]').text();
					url && $matrix.util.changeMain(url);
				}
			});
		}
	}
};

$matrix = $.fn.matrix;
$map = $matrix.map;

// set the selector
$map.selector = '#' + $map._id;

// attach mode handlers here because JS doesn't evaluate the LHS of an object property
// TODO document the context these methods are triggered in
$map.mode[MODE_NORMAL] = {
	enter: function() {
		// enable the standard asset context menu
		$($map.menuSelectors['asset']).contextMenu(true);

		// this is in the case we press escape after entering another mode
		// reselect what might have been selected
		$map.selected = $map.previousSelected;
		$map.previousSelected = [];

		$map._redrawSelected();
	},
	exit: function() {
		// disable the standard asset context menu
		$($map.menuSelectors['asset']).contextMenu(false);
	}
};
/*
$map.mode[MODE_MOVE] = {
	enter: $.noop,
	exit: $.noop
};
$map.mode[MODE_CLONE] = {
	enter: $.noop,
	exit: $.noop
};
$map.mode[MODE_LINK] = {
	enter: $.noop,
	exit: $.noop
};
*/
$map.mode[MODE_SELECT] = {
	enter: function() {
		// when hovering
//		$($map.selector + ' li')
//			.hover(
//				$matrix.util.mode5hover,
//				$matrix.util.mode5unhover
//			)
//			// TODO this could be setup at menu creation time and left alone
//			// unnecessary to add/remove this class
//			.find('.asset_name')
//				.addClass('selectable');


		// start the trees drag 'n' drop
		// the tree
		var t = $.jstree._reference($map.selector);
		// currently selected
		var s = t.data.ui.selected;
		if (!s.length) return;

		// the position of the selected element, to initiate drag from
		// TODO could use the mouse position here
		var p = s.offset();

/*
		// a fake event to appease jstree
		var e = $.Event('mousemove', {
			currentTarget: s,
			target: s,
			pageX: p.left,
			pageY: p.top
		});

		// this it
		$.vakata.dnd.drag_start(e, {
				jstree: true,
				obj : t
			}, "<ins class='jstree-icon'></ins>" + $(e.target).text()
		);
*/
		t.start_drag(s, $.Event('mousemove', {
			currentTarget: s,
			pageX: p.left,
			pageY: p.top
		}));

		// drag_start enables this, so we'll undo that
		// see jstree:2206
		$(document).unbind("mouseup", $.vakata.dnd.drag_stop);

		// we also need to disable the starting of drag on a click so we
		// can handle the context popup correctly
		// see jstree:2389
		t.get_container().undelegate("a", "mousedown.jstree");

		// enable link/copy/clone context menu
		$($map.menuSelectors['select']).contextMenu(true);
	},
	exit: function() {
		// disable link/copy/clone context menu
		$($map.menuSelectors['select']).contextMenu(false);

		// disable hover
//		$($map.selector + ' li')
//			.trigger('mouseleave')
//			.unbind('hover')
//			.find('.asset_name')
//				.removeClass('selectable');
		$.vakata.dnd.drag_stop({});

		// enable drag start again
		// see jstree:2389
		var t = $.jstree._reference($map.selector);
		t.get_container().delegate("a", "mousedown.jstree", $.proxy(function (e) {
console.log('custom mousedown', this);
			if(e.which === 1) {
				this.start_drag(e.currentTarget, e);
				return false;
			}
		}, t));

		// hide the markers
		// see jstree:2458
		// see jstree:2744
		if (t.dnd_expose().m) {
			t.dnd_expose().m
				.hide()
				.css({
					top: -2000
				});
		}
		if (t.dnd_expose().ml) {
			t.dnd_expose().ml
				.hide()
				.css({
					top: -2000
				});
		}
	}
}
$map.mode[MODE_USEME] = {
	color: null,
	enter: function() {
		$($map.selector).addClass('useme');

		// enable the "useme" context menus
		$($map.menuSelectors['useme-name']).contextMenu(true);
		$($map.menuSelectors['useme-li']).contextMenu(true);
	},
	exit: function() {
		$($map.selector).removeClass('useme');

		// disable the "useme" context menus
		$($map.menuSelectors['useme-name']).contextMenu(false);
		$($map.menuSelectors['useme-li']).contextMenu(false);
	}
};


// utils
$matrix.util = {
	mode5hover: function () {
		$(this).children('a').wrapAll($('<span class="asset_hold"></span>'));
	},
	mode5unhover: function () {
		var cnt = $('span.asset_hold', $(this)).contents();
		$('span.asset_hold', $(this)).replaceWith(cnt);
	},
	// change the contents of the main screen
	// see AssetMap.java:74
	changeMain: function (url) {
		if ($map.debug) console.log('opening', url);
		// here window refers to top.frames['sq_sidenav']
		window.frames['sq_main'].location = url;
	},
	// first argument is action, second is object containing command attributes
	// third is an array of children
	// see http://forum.jquery.com/topic/adding-xml-nodes-to-an-xmldocument-with-jquery-1-5
	getCommand: function getCommand(action, params, children) {
		var xml = $.parseXML('<command/>');
		var $xml = $(xml).find('command').attr('action', action);

		if (params) {
			for (var param in params) {
				if (!params.hasOwnProperty(param)) continue;
				$xml.attr(param, params[param]);
			}
		}
		switch (action) {
			case 'get url':
			case 'get assets':
			case 'move asset':
			case 'new link':
				children = children || [];
				for (var i = 0; i < children.length; i++) {
					var $asset = $(xml.createElement('asset')).appendTo($xml);

					for (var param in children[i]) {
						if (!children[i].hasOwnProperty(param)) continue;
						$asset.attr(param, children[i][param]);
					}
				}
			break;

			default:
				console.log('Doing nothing for command', arguments);
			break;
		}
		return xml;
	},
	// first argument is action, second is object containing command attributes
	// third is an array of children
	getCommandXML: function getCommandXML(action, params, children) {
		var command = $matrix.util.getCommand(action, params, children);
		// see http://joncom.be/code/javascript-xml-conversion/
		command = window.ActiveXObject ? command.xml : (new XMLSerializer()).serializeToString(command);
		if ($map.debug) console.log(command);
		return command;
	},
	getIconUrl: function getIconUrl(assetType) {
		return $matrix.backend.getUrl('/__data/asset_types/' + assetType + '/icon.png');
	},
	createCSSRule: function createCSSRule(assetType) {
		_createCSSRule('.context-menu-item.icon-' + assetType, 'background-image: url(' + $matrix.util.getIconUrl(assetType) + ');');
	},
	translate: function translate() {
		if ($map.debug) console.log('translating', arguments);
		// see Matrix.java:55
		var translation = $matrix.util.translationData[$map.locale][arguments[0]];

		if (!translation) return arguments[0];
		if (arguments.length > 1) {
			return $matrix.util.replaceParams(translation, [].splice.call(arguments, 1));
		}

		return translation;
	},
	// TODO this needs be initialised with at least $map.locale
	translationData: {},
	// see http://stackoverflow.com/questions/1353408/messageformat-in-javascript-parameters-in-localized-ui-strings
	replaceParams: function replaceParams(string, replacements) {
		return string.replace(/\{(\d+)\}/g, function() {
			return replacements[arguments[1]];
		});
	}
};


// this decouples the ajax requests from the operations to process their
// data, allowing other means to initialise the asset map
var initialise = function initialise(callback) {
	$.ajax({
		url: $matrix.backend.getUrl($map.params.adminSuffix),
		type: 'POST',
		processData: false,
		data: $matrix.util.getCommandXML('get translations'),
		contentType: "text/xml",
		dataType: 'xml',
		error: function (XMLHttpRequest, textStatus, errorThrown) {
			console.log(XMLHttpRequest, textStatus, errorThrown);
		},
		success: function(xml) {
			initialiseTranslation($(xml).find('translations'));
		},
		complete: function() {
			$.ajax({
				url: $matrix.backend.getUrl($map.params.adminSuffix),
				type: 'POST',
				processData: false,
				data: $matrix.util.getCommandXML('initialise'),
				contentType: "text/xml",
				dataType: 'xml',
				error: function (XMLHttpRequest, textStatus, errorThrown) {
					console.log(XMLHttpRequest, textStatus, errorThrown);
				},
				success: function(xml) {
init = $(xml);
//console.log(init);

					initialiseAssetTypes($(xml).find('asset_types'));

					$($map.selector)
						.bind("loaded.jstree", function (event, data) {
							buildContextMenus();
							buildBranch($($map.selector + ' [assetid=1]'), $(xml).find('assets'));
//							$map.checkRefresh();
						})
						.jstree({
							plugins:[
								'json_data',
								'crrm',
								'ui',
								'themes',
								'dnd',
								'types'
							],
							core: {
								animation: 0
							},
							types: {
								types: $map.assetTypes,
								type_attr: 'type_code'
							},
							themes: {
								theme: "classic",
								dots: true,
								icons: true
							},
							json_data: {
								data: [
									{
										data: 'root',
										state: 'closed',
										attr: {
											assetid: 1
										}
									}
								]
							},
							// see http://stackoverflow.com/questions/11000095/dnd-how-to-restrict-dropping-to-certain-node-types
							crrm: {
								input_width_limit: 200,
								move: {
									always_copy: "multitree", // false, true or "multitree"
									open_onmove: false,
									default_position: "last",
									check_move: function (m) {

										// we can check for valid parents here
										// potentially circumventing the "going to fail" hipo
//										if(!m.np.hasClass("someClassInTarget")) return false;
//										if(!m.o.hasClass("someClassInSource")) return false;
										return true;
									}
								}
							},
							dnd: {
								drag_finish: function(data) {
console.log('drag_finish', arguments);
								},
								drop_finish: function(data) {
console.log('drop_finish', arguments);
								}
							}
						})
						.bind("move_node.jstree", function(evt, data) {
console.log('move_node event', arguments);
							var t = $.jstree._reference(this);
							// we'll handle opening ourselves so we can control
							// the refresh better
							data.rslt.np.parentsUntil(".jstree").andSelf().filter(".jstree-closed").each(function () {
								t.open_node(this, false, true);
							});
						})
						// this is in the context of the tree
						.bind('open_node.jstree', function(evt, data) {
							if ($map.debug) console.log('open_node', arguments);

							// this is a lame way to get to the element
							// data.args[0] needs wrapping due to opening via dnd
							var $node = $(data.args[0]);

							if ($node.attr('assetid') === '1') return;
console.log('checking for open');
							// check to see if we've already got our children
							// this is broken when we're asked to open via dnd
							if ($node.find('ul').length) return;

							$node.attr('hasOpened', true);

							// expand this branch
							get_children(null, false, data.args[0]);
						})
						// this is to detect when we've programmatically started
						// dnd, and we want to finish
						// see jstree:2434
						.bind('mousedown.sqtree', function(evt) {
							// this is too blunt - want to close branches while in dnd
							if($.vakata.dnd.is_drag && $.vakata.dnd.user_data.jstree) {
								$.vakata.dnd.drag_stop({});
								t.dnd_finish(evt);
							}
						});
					// see http://code.google.com/p/jstree/issues/detail?id=977
// breaks moving via dnd
//					$.jstree._fn.get_rollback = function(){this.__callback();}

					// to play with later
					var t = $.jstree._reference($map.selector);

					// custom dnd_finish to handle opening the context menu
					var dnd_finish = function(e) {
console.log('dnd_finish', arguments);
//console.log('selected', t.data.ui.selected);
//console.log('target', $(e.target).closest('li'));

						var foundSelf = false;
						t.data.ui.selected.each(function() {
							if (this === $(e.target).closest('li').get(0)) {
								foundSelf = true;
								return false;
							}
						});

						if (foundSelf) {
console.log('self drop!');
							// let the original method clean up
//							return this.dnd_finish.old.apply(this, arguments);
							return;
						}

						this.dnd_prepare();

						// grab the info we need now because it's going away real shortly
						$map.dnd_info = {
							hidden: this.dnd_expose(),
							data: $.extend({}, this.data.dnd)
						};

						// a chance at making a difference
						$($map.menuSelectors['select']).contextMenu(e);
					};
					// TODO should probably use the prototype instead, and do
					// this before any trees are created
					dnd_finish.old = t.dnd_finish;
					t.dnd_finish = dnd_finish;
//					dnd_finish.old = $.jstree._fn.dnd_finish;
//					$.jstree._fn.dnd_finish = dnd_finish;


					// we'll make the first selection ourselves
					$(document)
						.bind('drag_start.vakata', function(evt, data) {
console.log('drag_start', arguments);

							// move into select mode
							// don't do this - dnd has already started, and
							// manually moving into MODE_SELECT will cause
							// dnd to start again (programatically, and worse)
//							$map.mode.change.call(data.event.target, MODE_SELECT);
							// just do the MODE_SELECT bits we need manually
							$map.mode.current = MODE_SELECT;
							$($map.menuSelectors['select']).contextMenu(true);

							// drag start should always use the originating node
							// see jstree:2459
							// TODO allow moving multiple nodes
							t.deselect_all();
							t.select_node($(data.event.target));

							// make the marker line full width
							// see jstree:2583
							// see jstree:2408
							t.dnd_expose().ml.css('width', $($map.selector).width() - $(data.event.target).offset().left);
						})
						.unbind('drag_stop.vakata')
						.bind("drag_stop.vakata", $.proxy(function () {
								if(this.data.dnd.to1) { clearTimeout(this.data.dnd.to1); }
								if(this.data.dnd.to2) { clearTimeout(this.data.dnd.to2); }
								if(this.data.dnd.i1) { clearInterval(this.data.dnd.i1); }
								if(this.data.dnd.i2) { clearInterval(this.data.dnd.i2); }
								this.data.dnd.after		= false;
								this.data.dnd.before	= false;
								this.data.dnd.inside	= false;
								this.data.dnd.off		= false;
								this.data.dnd.prepared	= false;
								this.data.dnd.w			= false;
								this.data.dnd.to1		= false;
								this.data.dnd.to2		= false;
								this.data.dnd.i1		= false;
								this.data.dnd.i2		= false;
								this.data.dnd.active	= false;
								this.data.dnd.foreign	= false;
								// we're doing everything except hiding the markers

console.log('drag stopped');
							}, t));



				},
				complete: function() {
					// now do whatever we were asked to do next
					// TODO there might not be much point to this if this request failed
					callback && callback();
				}
			});
		}
	});
};


// TODO this SHOULD BE a method of the map
var initialiseTranslation = function initialiseTranslation($xml) {
	var info = {};

	$.each($xml.text().split("\n"), function(i, trans) {
		if (!trans) return;
		// TODO I think this can be made a bit better...
		// though it needs discussion with core devs and translation maintainers
		var bits = trans.match(/([^=]+[^ ]) *= *([^ ]*.*)/);
		if (bits && bits.length)
			info[bits[1]] = bits[2];
	});

	$matrix.util.translationData[$xml.attr('locale')] = info;
}


var initialiseAssetTypes = function initialiseAssetTypes($xml) {
	// somewhere to store the asset types
	// used to define types for the tree
	$map.assetTypes = {};

	// the menu items
	var items = {};

	// We need to order the types by their type_codes
	// see MatrixMenus.java:369

	// an array of type names for sorting
	var types = [];
	// a map of arrays of type names for sorting
	var subTypes = {};

	// handle the action of a new asset
	var newAssetCallback = function(key, options) {
		// default add to tree root
		var $parent = $($map.selector + ' li[assetid=1]');
		var $this = $(this);

		// we clicked on an asset
		if ($this.parent('li[assetid]').length) {
			$parent = $this.parent('li[assetid]');
		}

		// if options.$trigger is not a jquery then we're adding to the tree root
		$matrix.backend.createAsset(key, $parent/*, parentPosition*/);
	}

	// Check each type that we find
	$xml.find('type').each(function() {
		var $this = $(this);

		var path = $this.attr('flash_menu_path');
		var type = $this.attr('type_code');

		// get screens (context menu items)
		// TODO order these
		var m = $map.assetScreens[type] = {};
		var mIndex = 0;
		$this.find('screen').each(function() {
			m[$(this).attr('code_name')] = {
				name: $(this).text(),
				index: mIndex++
			}
		});

		// store the type info for the tree
		// see http://www.jstree.com/documentation/types
		$map.assetTypes[type] = {
			icon: {
				image: $matrix.util.getIconUrl(type)
			},
			hover_node: false
		};

		// we skip if there's no path or it's not instantiable
		// see AssetType.java:75
		var instantiable = $this.attr('instantiable') === '1' || $this.attr('allowed_access') === 'system';

		if (path && instantiable) {
			if (!items[path]) {
				items[path] = {
					name: path,
					icon: type, // takes the icon of the first type in this group
					items: {}
				};

				// info for sorting
				types.push(path);
				subTypes[path] = [];
			}

			items[path]['items'][type] = {
				name: unescape($this.attr('name')),
				// TODO need to use the generic icon when this fails
				icon: type,
				info: $this,
				callback: newAssetCallback
			};
			// info for sorting
			subTypes[path].push(unescape($this.attr('name')));

			// construct an icon style
			$matrix.util.createCSSRule(type);
		}

	});// End each

	// see http://stackoverflow.com/questions/8996963/how-to-perform-case-insensitive-sorting-in-javascript
	var caseInsensitiveSort = function caseInsensitiveSort(a, b) {
		if (a.toLowerCase() < b.toLowerCase()) return -1;
		if (a.toLowerCase() > b.toLowerCase()) return 1;
		return 0;
	};

	types.sort(caseInsensitiveSort);
	items['order'] = types;

	// ordering sucks!
	// we need to order the submenus by name, however the menus
	// are built using their keys to index them :-/

	// find a menu key given the menu and an items name
	var findKey = function findKey(menu, itemName) {
		for (var k in menu) {
			if (!menu.hasOwnProperty(k)) continue;

			if (menu[k]['name'] === itemName) return k;
		}

		throw new Error('Cannot find menu item named "' + itemName + '"');
	};

	// sort the submenus
	for (type in subTypes) {
		if (!subTypes.hasOwnProperty(type)) continue;

		// order by name
		subTypes[type].sort(caseInsensitiveSort);

		// now replace with the type_code
		for (var i = 0, last = subTypes[type].length; i < last; i++) {
			subTypes[type][i] = findKey(items[type]['items'], subTypes[type][i]);
		}

		items[type]['items']['order'] = subTypes[type];

		// see jquery.contextMenu.js:1130
		// lame attempt at setting the width of the submenu
/*
		var longest = 0;
		$(subTypes[type]).each(function(i, subType) {
			if (items[type]['items'][String(subType)]['name'].length > longest) {
				longest = items[type]['items'][String(subType)]['name'].length;
			}
		});
		switch (true) {
			case longest > 25: items[type]['className'] = 'wide'; break;
			case longest > 15: items[type]['className'] = 'medium'; break;
		}
console.log(type, longest);
*/
	}

	// whack a separator and folder on the end
	items['sep'] = '-';
	items['folder'] = {
		name: 'Folder',
		icon: 'folder',
		callback: newAssetCallback
	};
	items['order'].push('sep');
	items['order'].push('folder');

	// preferring to do the folder CSS here because the base URL can change
	$matrix.util.createCSSRule('folder');


	// common bits on each types context menu
	var typeCommon = {
		sep: '-',
		teleport: {
			name: $matrix.util.translate('asset_map_menu_teleport'),
			disabled: true
		},
		refresh: {
			name: $matrix.util.translate('asset_map_menu_refresh'),
			callback: function(key, options) {
console.log('TODO refreshing something')
			},
			disabled: true
		},
		// TODO this item needs to be replaced after an asset has been
		// created
		prev: {
			name: $matrix.util.translate('asset_map_menu_no_previous_child'),
			disabled: true,
			callback: function(key, options) {
console.log('This needs to be populated with the entry from the most recently created child');
			}
		},
		'new': {
			name: 'New Child',
			items: items
		}
	};

	// create context menus for each asset type
	$.each($map.assetScreens, function(k, v) {
		$.extend(v, typeCommon);
	});


	$map.menuSelectors['asset'] = $map.selector + ' li[assetid] a';
	$.contextMenu({
		selector: $map.menuSelectors['asset'],
		trigger: 'right',
		build: function($trigger, e) {
			var $asset = $trigger.parent('li[assetid]');
			var items = $map.assetScreens[$asset.attr('type_code')];

			return {
				// requests for new children SHOULD BE handled automatically
				// we're just handling the first level of the menu (asset screens)
				callback: function(key, options) {
					var screenUrl = $matrix.backend.getScreenUrl(key, $asset);

					$matrix.util.changeMain(screenUrl);
				},
				items: items
			}
		}
	});

	$map.menuSelectors['main'] = $map.selector;
	$.contextMenu({
		selector: $map.menuSelectors['main'],
		trigger: 'right',
		callback: function(key, options) {
			console.log(arguments);

			// TODO this should go into a useme type state
			// and allow selecting the parent of the new asset
			// see MatrixTree.java:1332

			// create a new asset at the root
			// TODO work out where this asset is being added
			$matrix.backend.createAsset(key, 1 /*, TODO undefined*/);
		},
		items: items
	});
}


// Given some XML describing a level of the tree, construct the contents of that
// branch
// TODO neeed the following vars
//	current_asset
//	getField()
//	type_2_image - some prefix for special image contents
//	$target - effectively our return value where we've build the tree
var buildBranch = function buildBranch($root, $xml) {
	if ($map.debug) console.log('root', $root);

	// this is to control how we deal with the different values when we attach them to the dom
	var handlers = {
		integer: function(input) { return parseInt(input, 10); },
		string: function(input) { return unescape(input.replace(/\+/g, ' ')); },
		'default': function(input) { return input; }
	};

	// these are the fields we know about
	var fields = {
		link_type: handlers.integer,
		num_kids: handlers.integer,
		sort_order: handlers.integer,
		assetid: handlers.string,
		type_code: handlers.string,
		name: handlers.string,
		url: handlers.string
	};

	// handy translator for field values
	var getField = function(asset, fieldName) {
		return fields[fieldName] ? fields[fieldName](asset.attr(fieldName)) : asset.attr(fieldName);
	}

	// Check each asset that we find
	$xml.find('asset').each(function() {
		var $asset = $(this);

		if ($root.attr('assetid') == $(this).attr('assetid')) return;

		if (this.attributes.length) {
			// record our parent
			$asset.attr('parentid', $root.attr('assetid') || $root.attr('parent'));

			var info = {
				data: getField($asset, 'name'),
				attr: {
					// see http://stackoverflow.com/questions/6105905/drag-and-drop-events-in-dnd-plugin-in-jstree-are-not-getting-called
					'class': 'jstree-drop'
				},
				state: getField($asset, 'num_kids') > 0 ? 'closed' : undefined
			};

			// add our info
			// TODO this is bad, should consider using prop or data instead to store the values
			// see http://api.jquery.com/prop/
			$.each(this.attributes, function(i, attr) {
				info.attr[attr.name] = getField($asset, attr.name);
			});

			// add it to the tree
			// TODO how about the position in the parent?
			$($map.selector).jstree('create', $root, info.attr['sort_order'] || 'inside', info, false, true);

		}
	});
}


var refreshAssets = function refreshAssets(assetids) {
	if ($map.debug) console.log('refreshAssets', arguments);

	// we're doing this so if the root is being refreshed
	// we hit it first and forget the others
	// TODO this will need to change when we're selectively updating
	// the tree - at the moment we do a wholesale replace
//	assetids.sort();

	// get the asset
	var $assets = $('[assetid=' + assetids.join('],[assetid=') + ']', $map.selector);
	if ($map.debug) console.log('refreshing', assetids, $assets);

	$assets.each(function(i, asset) {
		var $asset = $(asset);
		get_children(null, false, $asset, true);

		// don't do anything else if we're refreshing the root
		// TODO reset the tree state after this
//		if (assetids[i] == '1') return false;
	});
}

/*
var refreshRoot = function refreshRoot(assetid) {
	var current_asset, parent = true;

	// Construct our XML to send
	var xml_get = $matrix.util.getCommandXML('get assets', {}, [{
		assetid: assetid,
		start: 0,
		limit: $map.params.fetchLimit,
		linkid: 10
	}]);

	// Get our children
	get_children(xml_get, parent, current_asset);
}
*/

var get_children = function get_children(xml_get, parent, $current_asset, replace) {
	// What do we add it to?
	var $target = $($map.selector);

	// are we replacing the contents?
	replace = replace || false;

	if (!parent) {
		// Construct our XML to send
		xml_get = $matrix.util.getCommandXML('get assets', {}, [{
			assetid: $current_asset.attr('assetid'),
			start: 0,
			limit: $map.params.fetchLimit,
			linkid: $current_asset.attr('linkid')
		}]);
	}

	// for removing the loading indicator
	var cls = 'loading' + String(Math.random()).replace(/^0\./, '');

	// Create our ajax to send the XML
	$.ajax({
		url: $matrix.backend.getUrl(),
		type: 'POST',
		processData: false,
		data: xml_get,
		contentType: "text/xml",
		dataType: 'xml',
		error: function (XMLHttpRequest, textStatus, errorThrown) {
			console.log(XMLHttpRequest, textStatus, errorThrown);
		},
		beforeSend: function () {
			$current_asset.children('a').append($('<img class="loading ' + cls + '" src="/dev/325.1.gif" width="12" height="12"></img>'));
		},
		success: function(xml) {
			// (re)build the list
			if (replace || !parent) {
				$target = $current_asset;
			}

			buildBranch($target, $(xml));
		},
		complete: function() {
			// Remove loading indicator
			$('.' + cls, $current_asset).remove();
		}
	});

}


$.fn.assetMapHandler = function() {
	return {
//		target: $.fn.matrixMaps[0],
		jsToJavaCall: function jsToJavaCall(type, command, params_str) {
//console.log('handling', arguments);
//console.log('with', this.target);
			switch (type) {
				case 'asset_locator':
					var bits = params_str.split("~");
					var types = bits[0].split('|');
					var positions = bits[1].split('|');

console.log(arguments);
					break;
				case 'asset_finder':
					switch (command) {
						case 'assetFinderStarted':
							var types = params_str.split('~');
							$map.mode.change(MODE_USEME);
							break;
						case 'assetFinderStopped':
							$map.mode.change(MODE_NORMAL);
							break;
					}

					break;
			}
		},
		getMap: function() { return $map; }
	};
}

/**
* Plugin that allows you to browse the MySource Matrix asset tree structure.
* This is beneficial sometimes as you can bypass the java asset map.
* It sends XML to Matrix, then receives an XML response.
* TODO allow multiple maps, and set each map according to the jQuery selector
* TODO define API to manipulate the map, especially an existing map
*
* @version $Revision: 0.1
*/
$.fn.matrixTree = function (options) {
	var defaults = {
		root: 1,
		showChildren: false,
		debug: true
	};

	options = $.extend(defaults, options);
console.log(this);
	var obj = $(this);

	// TODO multiple maps
	$map.selector = this.selector;

	initialise();

	// Bind when user clicks icon to invoke a map mode
	$(document).on('click', $map.selector + ' li.jstree-leaf', function(event) {
console.log(event);
console.log($map.selector + ' a > .jstree-icon', $map.mode.current);

		var $target = $(event.target);
//		var $this = $(this);

		switch ($map.mode.current) {
			case MODE_NORMAL:
				if ($target.is('.jstree-icon') && $target.parent().is('a')) {
console.log('bingo, got an icon');
					event.preventDefault();
					event.stopImmediatePropagation();

					$map.mode.change.call(this, MODE_SELECT);
					return false;
				}
				break;
			case MODE_SELECT:
				// need to do a programmatic drop
//				$.jstree._reference($map.selector).dnd_finish(event);
console.log('user_data', $.vakata.dnd.user_data);

				event.preventDefault();
				event.stopImmediatePropagation();

//				$map.mode.change.call(this, MODE_NORMAL);

				return false;
		}
	});


/*
	// Lets double click our parents to show their children
	$(document).on('dblclick', $map.selector + ' li a', function() {
		// Get our current asset
		var current_asset = $(this);
		var sub_root = $(this).attr('id').replace('a', '');

		// Build our tree
		get_children(null, false, current_asset);

		// stop the event
		return false;
	});


	// this is to handle a selection target (move/link/clone etc)
	$(document).on('click', $map.selector + ' li', function() {
//console.log($map.selector + ' li', $map.mode.current);

		switch ($map.mode.current) {
			case MODE_USEME:
				// anything?
			break;
			case MODE_SELECT:
				// This is where we workaround the shortcomings of the context
				// menu we've chosen - it only allows one trigger
				// TODO handle left click here to show dialog
				// we must have something selected here or we're boned!
				if (!$map.selected.length) {
					alert($matrix.util.translate('asset_map_error_invalid_node'));
					return;
				}

				// store the original selection
				$map.previousSelected = $map.selected;

				// highlight the new selection
				$map.select.call($(this).find('a.asset_name'));

				// the dialog is enabled via the change to select mode
			break;
			default:
			break;
		}
	});


	// Bind when user clicks on asset text
	// this fires before the context menu handler because we're stacked above
	// the menu trigger
	$(document).on('click', $map.selector + ' li a.asset_name', function(event) {
//console.log($map.selector + ' li a.asset_name', $map.mode.current);

		// TODO decide to show the menu or not
		switch ($map.mode.current) {
			// in this case we're behaving the same as the text, so we present
			// the wee menu with move/clone etc
			case MODE_SELECT:
console.log('clicked a.asset_name while in select mode');
			break;
			default:
				// it's the meta key on OSX (apple key)
				// if not pressed, then we have a single selection
				if (!event.metaKey)
					$map.selected = [];

				$map.select.call(this);
			break;
		}

		// we let the event continue to get to the context menu handler
	});


	// Bind when user clicks icon to invoke a map mode
	$(document).on('click', $map.selector + ' a.icon_hold', function(event) {
//console.log($map.selector + ' a.icon_hold', $map.mode.current);

		switch ($map.mode.current) {
			case MODE_SELECT:
				// I don't believe we get here, the context menu handler
				// has already eaten the event, which is OK
console.log('selected', $map.selected);
console.log('target', this);
			break;
			default:
				// changing into select mode
				// hmmm, we need some info about the event when doing this change

				// record what was selected
				var li = $(this).closest('li');
				var asset = li.find('a.asset_name');

				// select should always be called with the a.asset_name
				$map.select.call(asset.get(0));

				// and we're already hovering over ourselves
				li.trigger('mouseenter');

				$map.mode.change.call(this, MODE_SELECT);
			break;
		}

		// don't let the event continue
		return false;
	});
*/

	// Remove selector if clicking escape
	$(document).keyup(function(event) {
//console.log(event);
		switch (event.keyCode) {
			case 27: // escape
				if ($map.mode.current !== MODE_SELECT) return;
				$map.mode.change.call(this, 1);
			break;
			case 46: // delete
				if ($map.mode.current !== MODE_NORMAL) {
console.log('cannot delete from mode', $map.mode.current);
					return;
				}
				var t = $.jstree._reference($map.selector);
				if (!t.data.ui.selected.length) {
console.log('nothing selected', $map.selected);
					return;
				}
				console.log('deleting', t.data.ui.selected);
			break;
		}
	});//end keyup

};// End matrixMap


// see http://stackoverflow.com/questions/1720320/how-to-dynamically-create-css-class-in-javascript-and-apply
function _createCSSRule(selector, style) {
    if (!document.styleSheets) {
        return;
    }

    if (document.getElementsByTagName("head").length == 0) {
        return;
    }

    var stylesheet;
    var mediaType;
    if (document.styleSheets.length > 0) {
        for (i = 0; i < document.styleSheets.length; i++) {
            if (document.styleSheets[i].disabled) {
                continue;
            }
            var media = document.styleSheets[i].media;
            mediaType = typeof media;

            if (mediaType == "string") {
                if (media == "" || (media.indexOf("screen") != -1)) {
                    styleSheet = document.styleSheets[i];
                }
            } else if (mediaType == "object") {
                if (media.mediaText == "" || (media.mediaText.indexOf("screen") != -1)) {
                    styleSheet = document.styleSheets[i];
                }
            }

            if (typeof styleSheet != "undefined") {
                break;
            }
        }
    }

    if (typeof styleSheet == "undefined") {
        var styleSheetElement = document.createElement("style");
        styleSheetElement.type = "text/css";

        document.getElementsByTagName("head")[0].appendChild(styleSheetElement);

        for (i = 0; i < document.styleSheets.length; i++) {
            if (document.styleSheets[i].disabled) {
                continue;
            }
            styleSheet = document.styleSheets[i];
        }

        var media = styleSheet.media;
        mediaType = typeof media;
    }

    if (mediaType == "string") {
        for (i = 0; i < styleSheet.rules.length; i++) {
            if (styleSheet.rules[i].selectorText.toLowerCase() == selector.toLowerCase()) {
                styleSheet.rules[i].style.cssText = style;
                return;
            }
        }

        styleSheet.addRule(selector, style);
    } else if (mediaType == "object") {
        for (i = 0; i < styleSheet.cssRules.length; i++) {
            if (styleSheet.cssRules[i].selectorText.toLowerCase() == selector.toLowerCase()) {
                styleSheet.cssRules[i].style.cssText = style;
                return;
            }
        }

        styleSheet.insertRule(selector + "{" + style + "}", 0);
    }
}

})(jQuery);

