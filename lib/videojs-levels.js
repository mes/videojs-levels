/*! videojs-levels
 * Copyright (c) 2015 Hector G. Parra
 * Licensed under the Apache-2.0 license. */
(function(window, videojs) {
  'use strict';

  var defaults = {};

  /**
   * Return currently used MediaTechController.
   *
   * @method Player.getTech
   * @return MediaTechController
   */
  videojs.Player.prototype.getTech = function () {
    for (var key in this) {
      if (this[key] instanceof videojs.MediaTechController) {
        return this[key];
      }
    }
    return null;
  };

  /**
   * Return MediaTechController's HTML Element.
   *
   * @method MediaTechController.getEl
   * @return HTMLElement
   */
  videojs.MediaTechController.prototype.getEl = function () {
    for (var key in this) {
      if (this[key] instanceof HTMLElement) {
        return this[key];
      }
    }
    return null;
  };

  /**
   * Return MenuButton's MenuItems.
   *
   * @method MenuButton.getItems
   * @return MenuItem[]
   */
  videojs.MenuButton.prototype.getItems = function () {
    for (var key in this) {
      var isItems = Array.isArray(this[key]) && this[key].every(function (i) {
        return i instanceof videojs.MenuItem;
      });
      if (isItems) {
        return this[key];
      }
    }
    return [];
  };

  /**
   * Get Levels.
   * This provides interface to either Player tech.
   *
   * @method getLevels
   * @return Levels[]
   */
  videojs.Player.prototype.getLevels = function () {
    return this.getTech().getLevels();
  };

  /**
   * Set current level.
   * This provides interface to either Player tech.
   *
   * @method setLevel
   * @param  {Number} level
   * @return Levels[]
   */
  videojs.Player.prototype.setLevel = function (level) {
    this.getTech().setLevel(level);
  };

  //
  // [FLASH] getLevels/setLevel implementation
  //
  if ('undefined' != typeof videojs.Flash) {
    videojs.Flash.prototype.getLevels = function () {
      return this.getEl().vjs_getProperty('levels') || [];
    };

    videojs.Flash.prototype.setLevel = function (level) {
      this.getEl().vjs_setProperty('level', level);
    };
  }

  //
  // [Html5] getLevels/setLevel implementation
  //
  if ('undefined' != typeof videojs.Html5) {
    videojs.Html5.prototype.getLevels = function () {
      return [];
    };

    videojs.Html5.prototype.setLevel = function (level) {
      // Do nothing
    };
  }

  //
  // [YouTube] getLevels/setLevel implementation
  // This tech implements its own Level menu, so disable ours.
  //
  if ('undefined' != typeof videojs.Youtube) {
    videojs.Youtube.prototype.getLevels = function () {
      return [];
    };

    videojs.Youtube.prototype.setLevel = function (level) {
      // Do nothing
    };
  }

  //
  // [HLSJS] getLevels/setLevel implementation
  //
  if ('undefined' != typeof videojs.HlsJs) {
    videojs.HlsJs.prototype.getLevels = function () {
      function sortByBitrate(a, b){
        return ((a.bitrate < b.bitrate) ? -1 : ((a.bitrate > b.bitrate) ? 1 : 0));
      }

      // List provided just needs to be indexed...
      var levels = this.hls.levels.slice(0); // clone it, @see https://davidwalsh.name/javascript-clone-array
      for (var i=0; i < levels.length; i++) {
        levels[i].index = i;
      }
      // ... and sorted
      levels.sort(sortByBitrate);
      return levels;
    };

    videojs.HlsJs.prototype.setLevel = function (level) {
      this.hls.nextLevel = level;
    };
  }

  //
  // [HLS] getLevels/setLevel implementation
  //
  if ('undefined' != typeof videojs.Hls) {
    videojs.Hls.prototype.getLevels = function () {
      var levels = [];
      for (var i=0; i < this.playlists.master.playlists.length; i++) {
        var variant = this.playlists.master.playlists[i];
        // @see org.mangui.hls.model.Level
        var level = {
          bitrate: variant.attributes.BANDWIDTH,
          name: variant.attributes.NAME,
          index: i,
          width: 'undefined' != typeof variant.attributes.RESOLUTION ? variant.attributes.RESOLUTION.width : undefined,
          height: 'undefined' != typeof variant.attributes.RESOLUTION ? variant.attributes.RESOLUTION.height : undefined,
          url: this.playlists.master.playlists[i].uri
        };
        levels.push(level);
      }
      return levels;
    };
  
    videojs.Hls.prototype.setLevel = function (level) {
      this.forceLevel = level;
    };
  
    // override selectPlaylist
    videojs.Hls.prototype._selectPlaylist = videojs.Hls.prototype.selectPlaylist;
    videojs.Hls.prototype.selectPlaylist = function() {
      return ('undefined' != typeof this.forceLevel && -1 != this.forceLevel)
            ? this.playlists.master.playlists[this.forceLevel]
            : this._selectPlaylist();
    }
  }
  
  /**
   * LevelsMenuButton
   */
  videojs.LevelsMenuButton = videojs.MenuButton.extend({

    className: 'vjs-menu-button-levels',

    init: function (player, options) {
      videojs.MenuButton.call(this, player, options);
    },

    createItems: function () {

      var component = this;
      var player = component.player();
      var levels = player.getLevels();

      if (!levels.length) {
        return [];
      }

      // Prepend levels with 'Auto' item
      var levels = [{
        name:  'Auto',
        index:  -1
      }].concat(levels);

      return levels.map(function (level, idx) {

        // Select a label based on available information
        // name and height are optional in manifest
        var levelName;

        if (level.name) {
          levelName = level.name;
        } else if (level.height) {
          levelName = level.height + 'p';
        } else {
          levelName = Math.round(level.bitrate / 1000) + ' Kbps';
        }

        var item = new videojs.MenuItem(player, {
          label:    levelName,
          value:    level.index,
          selected: level.index === -1 // Assume Auto is preselected
        });

        item.on('click', function (evt) {
          component.getItems().forEach(function (i) {
            i.selected(false);
          });

          this.selected(true);

          player.setLevel(this.options().value);
        });

        return item;
      });
    },

  });

  // register the plugin
  videojs.plugin('levels', function(options) {

    var settings = videojs.util.mergeOptions(defaults, options);
    var player = this;
    var button = null;

    player.on('loadedmetadata', function (evt) {
      if (button) {
        button.dispose();
      }
      button = new videojs.LevelsMenuButton(player, settings);
      player.controlBar.addChild(button);
    });
  });

})(window, window.videojs);
