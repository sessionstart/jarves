/*
 * This file is part of Jarves.
 *
 * (c) Marc J. Schmidt <marc@marcjschmidt.de>
 *
 *     J.A.R.V.E.S - Just A Rather Very Easy [content management] System.
 *
 *     http://jarves.io
 *
 * To get the full copyright and license information, please view the
 * LICENSE file, that was distributed with this source code.
 */

jarves.Slot = new Class({

    Binds: ['fireChange'],
    Implements: [Options, Events],

    options: {
        node: {},
        standalone: true
    },

    slot: null,
    slotParams: {},
    editor: null,

    initialize: function(domSlot, options, editor) {
        this.slot = domSlot;
        this.slot.kaSlotInstance = this;
        this.setOptions(options);
        this.editor = editor;

        var params = this.slot.get('params') || '';
        this.slotParams = JSON.decode(params) || {};

        this.singleSlot = domSlot.hasClass('jarves-single-slot');

        this.renderLayout();
        this.mapDragEvents();
        this.addEvent('change', this.onChange.bind(this));

        if (this.options.standalone) {
            this.loadContents();
        }
    },

    onChange: function() {
        if (this.isSingleSlot()) {
            var children = document.id(this).getChildren('.jarves-content');
            if (0 !== children.length) {
                this.placer.dispose();
            } else {
                this.placer.inject(this, 'top');
            }
        }
    },

    /**
     * @returns {Boolean}
     */
    isSingleSlot: function() {
        return this.singleSlot;
    },

    getParam: function(key) {
        return this.slotParams[key];
    },

    /**
     * @returns {jarves.Editor}
     */
    getEditor: function() {
        return this.editor;
    },

    getBoxId: function() {
        return this.slotParams.id;
    },

    mapDragEvents: function() {
        this.slot.addListener('dragover', function(e) {
            return this.checkDragOver(e);
        }.bind(this), false);

        this.slot.addListener('dragleave', function(e) {
            this.removePlaceholder = true;
            (function(){
                if (this.removePlaceholder && this.lastPlaceHolder) {
                    this.lastPlaceHolder.destroy();
                }
                delete this.removePlaceholder;
            }).delay(100, this);
        }.bind(this), false);

        this.slot.addListener('drop', function(e) {
            return this.checkDrop(e);
        }.bind(this), false);
    },

    checkDrop: function(event) {
        var target = event.toElement || event.target;
        var slot = this.slot;

        if (target) {
            if (!target.hasClass('jarves-slot')) {
                slot = target.getParent('.jarves-slot');
                if (slot !== this.slot) {
                    //the target slot is not this slot instance.
                    return;
                }
            }

            var items = event.dataTransfer.files.length > 0 ? event.dataTransfer.files : event.dataTransfer.items,
                data, content;

            if (!items && event.dataTransfer.types) {
                items = [];
                Array.each(event.dataTransfer.types, function(type) {
                    var dataType = event.dataTransfer.getData(type);
                    items.push({
                        type: type,
                        getAsString: function(cb) {
                            cb(dataType);
                        }
                    });
                });
            }

            if (this.lastPlaceHolder) {
                if (items) {
                    Array.each(items, function(item) {

                        data = null;

                        if ('application/json' === item.type) {
                            item.getAsString(function(data) {
                                if (data && (!JSON.validate(data) || !(data = JSON.decode(data)))) {
                                    data = null;
                                }
                                if (data) {
                                    content = this.addContent(data, true, item);
                                    document.id(content).inject(this.lastPlaceHolder, 'before');
                                }

                                this.lastPlaceHolder.destroy();
                            }.bind(this));
                        } else {
                            //search for plugin that handles it
                            Object.each(jarves.ContentTypes, function(type, key) {
                                if ('array' === typeOf(type.mimeTypes) && type.mimeTypes.contains(item.type)) {
                                    data = {
                                        type: key
                                    };
                                }
                            });

                            if (data) {
                                content = this.addContent(data, true, item);
                                document.id(content).inject(this.lastPlaceHolder, 'before');
                                this.lastPlaceHolder.destroy();
                            }
                        }

                    }.bind(this));
                } else {
                    this.lastPlaceHolder.destroy();
                }
            }

            event.stopPropagation();
            event.preventDefault();
            return false;
        }
    },

    checkDragOver: function(event) {
        var target = event.toElement || event.target;
        var slot = this.slot, content;

        if (target) {
            if (!target.hasClass('jarves-slot')) {
                slot = target.getParent('.jarves-slot');
                if (slot !== this.slot) {
                    //the target slot is not this slot instance.
                    return;
                }
            }

            //event.dataTransfer.dropEffect = 'move';

            delete this.removePlaceholder;

            content = target.hasClass('jarves-content') ? target : target.getParent('.jarves-content');

            if (!this.lastPlaceHolder) {
                this.lastPlaceHolder = new Element('div', {
                    'class': 'jarves-editor-drag-placeholder'
                });
            }

            var zoom = (parseInt(this.slot.getDocument().body.style.zoom || 100) / 100);

            //upper area or bottom?
            if (content) {
                var injectPosition = 'after';
                if (event.pageY / zoom - content.getPosition(document.body).y < (content.getSize().y / 2)) {
                    injectPosition = 'before';
                }
                this.lastPlaceHolder.inject(content, injectPosition);
            } else {
                slot.getChildren().each(function(child) {
                    if (event.pageY / zoom > child.getPosition(document.body).y + 5) {
                        content = child;
                    }
                });

                if (content) {
                    this.lastPlaceHolder.inject(content, 'after');
                } else {
                    this.lastPlaceHolder.inject(slot, event.pageY / zoom > (slot.getSize().y / 2 ) ? 'top' : 'bottom');
                }
            }

            event.stopPropagation();
            event.preventDefault();
            return false;
        }
    },

    renderLayout: function() {
        this.slot.empty();

        if (this.isSingleSlot()) {
            this.placer = new Element('div', {
                'class': 'jarves-single-content-placer'
            }).inject(this.slot);

            var label = t('Press to add content.');
            if (this.getParam('type')) {
                var type = this.getParam('type');
                var clazz = jarves.ContentTypes[type] || jarves.ContentTypes[type.capitalize()];
                label = tf('Press to add content of type %s.', clazz.label);
            }

            new Element('span', {
                'class': 'icon-plus-5',
                html: t('Empty content.') + '<br/>' + label
            }).inject(this.placer);

            this.placer.addEvent('click', function() {
                this.addSingleContent();
            }.bind(this));

            if (!this.getParam('optional') && this.getParam('type')) {
                this.placer.empty();
                this.addSingleContent();
            }

        } else {
            this.placer = new Element('div', {
                'class': 'jarves-content-placer'
            }).inject(this.slot);

            new Element('a', {
                text: '+',
                'class': 'jarves-content-placer-place'
            }).inject(this.placer);
        }
    },

    addSingleContent: function() {
        var types = null;
        if (this.getParam('type')) {
            types = this.getParam('type').replace(/\s/g, '').split(',');
        }
        if (!this.getParam('optional') && types && 1 === types.length) {
            var defaultValue = this.getParam('defaultValue');
            var value = {
                type: this.getParam('type'),
                content: 'null' === typeOf(defaultValue) ? '' : defaultValue
            };
            var content = this.addContent(value, true, null, true);
            if (!this.getParam('optional')) {
                content.setRemoveAble(false);
            }
        } else {
            this.getEditor().showAddContent(this, this.placer, types);
        }
    },

    fireChange: function() {
        this.fireEvent('change');
    },

    loadContents: function() {
        if (this.options.node.id) {
            this.lastRq = new Request.JSON({url: _pathAdmin + 'object/jarves/content', noCache: true,
                onComplete: this.renderContents.bind(this)}).get({
                    filter: {boxId: this.slotParams.id, node: this.options.node.id},
                    order: {sort: 'asc'}
                });
        }
    },

    renderContents: function(response) {
        this.setValue(response.data);
    },

    setValue: function(contents) {
        this.renderLayout();
        if ('array' === typeOf(contents)) {
            Array.each(contents, function(content) {
                this.addContent(content)
            }.bind(this));
        }
    },

    /**
     * @returns {Element}
     */
    toElement: function() {
        return this.slot;
    },

    /**
     * @param {jarves.ProgressWatch} progressWatch
     */
    setProgressWatch: function(progressWatch) {
        this.progressWatch = progressWatch;
    },

    /**
     *
     * @returns {null}
     */
    getProgressWatch: function() {
        return this.progressWatch;
    },

    /**
     * @returns {Boolean}
     */
    hasChanges: function() {
        var hasChanges = false;
        this.getContents().each(function(content) {
            if (!hasChanges && content.isDirty()) {
                hasChanges = true;
            }
        });

        return hasChanges;
    },

    /**
     *
     * @param {Boolean} visible
     * @param {jarves.ProgressWatch} progressWatch
     */
    setPreview: function(visible, progressWatch) {
        var manager = new jarves.ProgressWatchManager({
            allDone: function() {
                progressWatch.done();
            }
        });

        var watcher = {};

        this.slot.getChildren('.jarves-content').each(function(content, idx) {
            watcher[idx] = manager.newProgressWatch();
        });

        this.slot.getChildren('.jarves-content').each(function(content, idx) {
            content.kaContentInstance.setPreview(visible, watcher[idx]);
        });
    },

    /**
     *
     * @param {jarves.ProgressWatch} progressWatch
     * @returns {Array}
     */
    getValue: function(progressWatch) {
        var result = [];

        this.getContents().each(function(content){
            result.push(content.getValue());
        });

        return result;
    },

    /**
     *
     * @returns {Number}
     */
    getId: function() {
        return this.slotParams.id;
    },

    /**
     * @returns {jarves.Content[]}
     */
    getContents: function() {
        var contents = [];
        this.slot.getChildren('.jarves-content').each(function(content, idx) {
            if (content.kaContentInstance) {
                if (this.getId() != content.kaContentInstance.getBoxId()) {
                    content.kaContentInstance.setBoxId(parseInt(this.getId()));
                    content.kaContentInstance.setDirty(true);
                }
                if (content.kaContentInstance.getSortId() != idx + 1) {
                    content.kaContentInstance.setSortId(idx + 1);
                    content.kaContentInstance.setDirty(true);
                }
                contents.push(content.kaContentInstance);
            }
        }.bind(this));
        return contents;
    },

    /**
     *
     * @param {Object}  content
     * @param {Boolean} focus
     * @param {Array}   drop
     * @param {Boolean} isAdd
     *
     * @returns {jarves.Content}
     */
    addContent: function(content, focus, drop, isAdd) {
        if (!content) {
            content = {type: 'text'};
        }

        if (!content.template) {
            content.template = 'JarvesBundle:Default:content.html.twig';
        }

        var contentInstance = new jarves.Content(content, this.slot, drop, isAdd);
        contentInstance.addEvent('change', this.fireChange);

        if (focus) {
            this.getEditor().select(contentInstance);
            contentInstance.focus();
        }

        this.fireChange();
        return contentInstance;
    }

});