// see http://stackoverflow.com/questions/958419/custom-resizable-handles-in-jquery-ui
// and http://stackoverflow.com/questions/7450791/extending-widgets-in-jquery-ui-with-redefining-parent-methods
(function($) {
    $.widget("sq.resizable", $.ui.resizable, {
        _create: function() {
			// easiest thing to do here is reset the scope that the event handlers
			// will be attached under
			var element = this.element;
			this.element = element.parent();

            $.ui.resizable.prototype._create.call(this);

			// reset the scope
			this.element = element;

			// see http://stackoverflow.com/questions/958419/custom-resizable-handles-in-jquery-ui
			var that = this;
			for (i in this.handles) {
				$(this.handles[i])
				    .unbind('mousedown.resizable')
					.bind('mousedown.resizable', function(event) {
						return that._mouseDown(event);
					});
			}
		},

		_mouseCapture: function(event) {
			// let our parent try if there's a direct target
			// the idea here is that we're preserving the normal resizable behaviour - untested
			var handle = event.target ? $.ui.resizable.prototype._mouseCapture.call(this, event) : false;

			for (var i in this.handles) {
				// see http://stackoverflow.com/questions/958419/custom-resizable-handles-in-jquery-ui
				// TODO only tested in chrome
				if ($(this.handles[i])[0] == event.delegateTarget) {
					handle = true;
				}
			}

			return !this.options.disabled && handle;
		}
	});

})(jQuery);