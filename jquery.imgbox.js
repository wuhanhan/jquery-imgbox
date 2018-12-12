/*
 *  jquery-imgbox - v1.1.2
 *  A jQuery plugin that draws a box over an image.
 *  https://github.com/davidnewcomb/jquery-imgbox/
 *
 *  Copyright (c) 2018 David Newcomb, http://www.bigsoft.co.uk
 *  MIT License
 */
(function($) {

	$.fn.imgbox = function(options) {

		// Public functions
		var publicFn = {};

		var uniq = getUniqueId();

		var defaultSettings = {

			// Debug

			// extra messages
			debug : false,
			// nice name, for debugging
			name : '',

			// set of highlight styles
			markStyle : {
				'border' : '1px solid yellow'
			},

			// Addition features

			// edit - edit co-ordinate box
			command : '',
			// Call back to save box co-ordinates
			saveBox : callbackSaveBox,

			// Mainly internal use

			// Wrap the IMG tag if the coordinates are invalid, such
			// as edit
			wrapIfInvalid : false,

			// Interval to update when image not there
			retryInterval : 1000
		};

		var settings = $.extend(defaultSettings, options);
		if (settings.command == 'edit') {
			settings.wrapIfInvalid = true;
		}
		settings.markStyle['position'] = 'absolute';

		var allElments = this;
		var parentClass = 'imgbox-group-' + uniq;

		var editButtonDown = false;

		var startX = 0;
		var startY = 0;
		var endX = 0;
		var endY = 0;
		var normalisedCoords;
		var debugLabel = debugLabel();

		init();
		$('.' + parentClass).each(resizeImgbox);

		function init() {
			var pageContainsElements = replaceImgboxes();
			if (pageContainsElements == false) {
				debug('page contains no elements');
				return;
			}
			$(window).on('resize', windowResizeImgbox);

			if (settings.command == 'edit') {
				debug('settings.command:edit');
				$(allElments).on('click', editClick);
				$(allElments).on('mousemove', editMousemove);
			}
		}

		function editRedraw(parent) {
			normalisedCoords = calcCoords(startX, startY, endX, endY);
			parent.each(resizeImgbox);
		}

		function editClick(e) {
			mouseClick($(this), e.offsetX, e.offsetY);
		}

		function editMarkerClick(e) {
			var off = divPosition(this);
			mouseClick($(this).parent().find('img'), off.x + e.offsetX, off.y + e.offsetY);
		}

		function editMousemove(e) {
			mouseMove(this, e.offsetX, e.offsetY);
		}

		function editMarkerMousemove(e) {
			var off = divPosition(this);
			mouseMove(this, off.x + e.offsetX, off.y + e.offsetY);
		}

		function divPosition(div) {
			var o = {};
			o.x = parseInt($(div).css('left').replace(/px/, ''));
			o.y = parseInt($(div).css('top').replace(/px/, ''));
			return o;
		}

		function mouseMove(both, x, y) {
			if (editButtonDown) {
				endX = x;
				endY = y;
				var parent = $(both).parent();
				editRedraw(parent);
			}
		}

		function mouseClick(img, x, y) {
			if (editButtonDown) {
				// Second click
				endX = x;
				endY = y;
				normalisedCoords = calcCoords(startX, startY, endX, endY);
				saveBoxPrivate($(img), normalisedCoords);
			} else {
				// First click
				endX = startX = x;
				endY = startY = y;
				normalisedCoords = calcCoords(startX, startY, endX, endY);
			}
			var parent = $(img).parent();
			editRedraw(parent);
			editButtonDown = !editButtonDown;
		}

		function saveBoxPrivate($img, coords) {
			var width = $img.width();
			var realWidth = $img[0].naturalWidth;
			var ratio = realWidth / width;

			var o = {};
			o.x = Math.floor(coords.x * ratio);
			o.y = Math.floor(coords.y * ratio);
			o.x2 = Math.floor(coords.x2 * ratio);
			o.y2 = Math.floor(coords.y2 * ratio);
			o.w = Math.floor(coords.w * ratio);
			o.h = Math.floor(coords.h * ratio);
			$img.data(o);
			settings.saveBox(o);
		}

		function replaceImgboxes() {
			var pageContainsElements = false;
			allElments.each(function(idx, img) {

				var parent = $(img).parent();

				var marker = $('<div>');
				if (settings.command == 'edit') {
					$(marker).on('click', editMarkerClick);
					$(marker).on('mousemove', editMarkerMousemove);
				}

				var div = $('<div>').attr({
					'class' : parentClass
				}).css({
					'position' : 'relative'
				}).append($(img)).append(marker);
				$(parent).append(div);
				div.each(resizeImgbox);
				pageContainsElements = true;
			});
			return pageContainsElements;
		}

		publicFn.redraw = windowResizeImgbox;
		function windowResizeImgbox() {
			$('.' + parentClass).each(resizeImgbox);
		}

		/**
		 * x,y,w,h will always be valid. x2,y2 may be valid if set.
		 * otherwise null
		 */
		function validateData(data) {
			if (data == undefined || data.x == undefined || data.y == undefined) {
				debug('missing one of x,y');
				return null;
			}

			if (data.w == undefined || data.h == undefined) {
				if (data.x2 == undefined || data.y2 == undefined) {
					debug('missing one of w,h|x2,y2');
					return null;
				} else {
					data.w = Math.abs(data.x2 - data.x);
					data.h = Math.abs(data.y2 - data.y);
				}
			} else {
				if (data.x2 == undefined || data.y2 == undefined) {
					data.x2 = data.x + data.w;
					data.y2 = data.y + data.h;
				}
			}
			return data;
		}

		function resizeImgbox(idx, parent) {
			var worked = resizeImgboxInternal(idx, parent);
			if (!worked) {
				debug('add timer');
				var timer = setInterval(function() {
					debug('run timer');
					worked = resizeImgboxInternal(idx, parent);
					if (worked) {
						clearInterval(timer);
					}
				}, settings.retryInterval);
			}
		}

		function resizeImgboxInternal(idx, parent) {

			var $img = $(parent).find('img');
			var data;

			if (settings.command == 'edit' && editButtonDown) {
				data = normalisedCoords = calcCoords(startX, startY, endX, endY);
			} else {
				data = validateData($img.data());
				if (data == null) {
					return true;
				}
				data = actualToScreen($img, data);
				if (data == null) {
					return false;
				}
			}

			var padded_left = parseInt($img.css('padding-left').replace(/px/, '')) + data.x;
			var padded_top = parseInt($img.css('padding-top').replace(/px/, '')) + data.y;

			var css = {
				'left' : padded_left,
				'top' : padded_top,
				'width' : data.w,
				'height' : data.h,
			};
			var markerCss = $.extend({}, settings.markStyle, css);
			$(parent).find('div').css(markerCss);
			return true;
		}

		function actualToScreen($img, actual) {
			var width = $img.width();
			var realWidth = $img[0].naturalWidth;
			if (realWidth == 0) {
				debug('realWidth:bad');
				return null;
			}
			var ratio = width / realWidth;

			var o = {};
			o.x = Math.floor(actual.x * ratio);
			o.y = Math.floor(actual.y * ratio);
			o.x2 = Math.floor(actual.x2 * ratio);
			o.y2 = Math.floor(actual.y2 * ratio);
			o.w = Math.floor(actual.w * ratio);
			o.h = Math.floor(actual.h * ratio);

			return o;

		}

		// Taken from
		// https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript#8809472
		function getUniqueId() { // Public Domain/MIT
			var d = new Date().getTime();
			if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
				// use high-precision timer if available
				d += performance.now();
			}
			return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
				var r = (d + Math.random() * 16) % 16 | 0;
				d = Math.floor(d / 16);
				return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
			});
		}

		/*
		 * Override 'saveBox' to save co-ordinates. coord { x, y, w, h,
		 * x2, y2 }
		 */
		function callbackSaveBox(coord) {
			console.log(coord);
		}

		function calcCoords(sX, sY, eX, eY) {
			var o = {};
			o.x = Math.min(sX, eX);
			o.y = Math.min(sY, eY);
			o.x2 = Math.max(sX, eX);
			o.y2 = Math.min(sY, eY);
			o.w = Math.abs(sX - eX);
			o.h = Math.abs(sY - eY);
			return o;
		}

		function debugLabel() {
			var label = 'imgbox: ';
			if (settings.name == '') {
				label += parentClass;
			} else {
				label += settings.name + ' (' + parentClass + ')';
			}
			return label;
		}

		function debug(str, o) {
			if (settings.debug) {
				if (o == undefined) {
					console.log('imgbox:' + debugLabel + ' ' + str);
				} else {
					console.log('imgbox:' + debugLabel + ' ' + str, o);
				}
			}
		}

		// Return public functions
		return publicFn;

	};

}(jQuery));
