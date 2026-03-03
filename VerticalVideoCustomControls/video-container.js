class VideoContainer extends HTMLElement {
    static {
        customElements.define("video-container", VideoContainer);
    }

    static get observedAttributes() {
        return ["src"];
    }
    #video;

    constructor() {
        super();
    }

    async connectedCallback() {
        this.attachShadow({ mode: "open" });
        this.shadowRoot.innerHTML = this.#template;

        this.#video = this.shadowRoot.querySelector('video');
        this.#video.playsInline = this.getAttribute('playsInline') || true;

        let sourceSlot = this.shadowRoot.querySelector('slot[name=source]');
        sourceSlot.assignedElements({ flatten: true }).forEach(element => this.#video.appendChild(element.cloneNode()));

        sourceSlot.addEventListener('slotchange', event => {
            this.#video.querySelectorAll('source').forEach(source => source.remove());
            event.target.assignedElements({ flatten: true }).forEach(element => this.#video.appendChild(element.cloneNode()));
        });

        let trackSlot = this.shadowRoot.querySelector('slot[name=track]');
        trackSlot.assignedElements({ flatten: true }).forEach(element => this.#video.appendChild(element.cloneNode()));

        trackSlot.addEventListener('slotchange', event => {
            this.#video.querySelectorAll('track').forEach(track => track.remove());
            event.target.assignedElements({ flatten: true }).forEach(element => this.#video.appendChild(element.cloneNode()));
        });

        if (this.hasAttribute('src'))
            this.#video.src = this.getAttribute('src');
        if (this.hasAttribute('loop'))
            this.#video.loop = true;
        this.#video.load();

        let timeline = this.shadowRoot.querySelector('.timeline');
        let currentTime = this.shadowRoot.querySelector('.current-time');
        let remainingTime = this.shadowRoot.querySelector('.remaining-time');

        function formatTime(value) {
            let sign = Math.sign(value)
            let seconds = Math.trunc(Math.abs(value)) % 60;
            let minutes = Math.trunc(Math.abs(value) / 60);
            return `${ sign === -1 ? '-' : ''}${ minutes.toString().padStart(2, '0') }:${ seconds.toString().padStart(2, '0') }`;
        };

        this.#video.addEventListener('durationchange', event => {
            remainingTime.innerText = formatTime(this.#video.currentTime - this.#video.duration);
            timeline.max = this.#video.duration;
            timeline.value = this.#video.currentTime;
        });

        this.#video.addEventListener('timeupdate', event => {
            currentTime.innerText = formatTime(this.#video.currentTime);
            remainingTime.innerText = formatTime(this.#video.currentTime - this.#video.duration);
            timeline.value = this.#video.currentTime;
        });

        this.#video.textTracks.addEventListener('addtrack', event => { this.#updateTextTracks(); })
        this.#video.textTracks.addEventListener('removetrack', event => { this.#updateTextTracks(); })
        this.#video.textTracks.addEventListener('change', event => { this.#updateTextTracks(); })

        this.shadowRoot.querySelector('.play-pause').addEventListener('click', event => {
            this.#video.paused ? this.#video.play() : this.#video.pause();
        });

        this.shadowRoot.querySelector('.mute').addEventListener('click', event => {
            this.#video.muted = !this.#video.muted;
        });

        timeline.addEventListener('change', event => {
            this.#video.currentTime = timeline.value;
        });

        this.shadowRoot.querySelector('.pip').addEventListener('click', event => {
            if (this.#video.requestPictureInPicture && document.pictureInPictureElement !== this.#video)
                this.#video.requestPictureInPicture();
            else if (document.exitPictureInPicture && document.pictureInPictureElement === this.#video)
                document.exitPictureInPicture();
        });

        this.shadowRoot.querySelector('.fullscreen').addEventListener('click', event => {
            if (this.shadowRoot.host.requestFullscreen && document.fullscreenElement !== this.shadowRoot.host)
                this.shadowRoot.host.requestFullscreen({navigationUI: "hide"});
            else if (document.exitFullscreen && document.fullscreenElement === this.shadowRoot.host)
                document.exitFullscreen();
            else if (this.#video.webkitDisplayingFullscreen)
                this.#video.webkitExitFullscreen();
            else
                this.#video.webkitEnterFullscreen();
        });

        this.shadowRoot.querySelector('.video-controls').addEventListener('click', event => {
            if (this.#video.paused)
                this.#video.play();
            else
                this.#video.pause();
        });

        this.shadowRoot.querySelector('.video-controls-bar').addEventListener('click', event => {
            event.stopPropagation();
        });

        let captionsButton = this.shadowRoot.querySelector('.captions');
        captionsButton.classList.toggle('hidden', this.#video.showCaptionDisplaySettings == undefined);
        captionsButton.addEventListener('click', event => this.#toggleCaptions(event) );

        let captionsOnOption = this.shadowRoot.querySelector('.captions-menu #captions-on');
        captionsOnOption.addEventListener('change', event => this.#updateCaptionsEnabled(event) );

        let captionsOffOption = this.shadowRoot.querySelector('.captions-menu #captions-off');
        captionsOffOption.addEventListener('change', event => this.#updateCaptionsEnabled(event) );

        let captionsSettingsButton = this.shadowRoot.querySelector('.captions-menu .section.styles .button');
        captionsSettingsButton.addEventListener('click', event => this.#showCaptionSettings(event) );
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (this.#video) {
            if (name.toLowerCase() === 'src')
                this.#video.src = newValue;
            if (name.toLowerCase() === 'playsinline')
                this.#video.playsInline = newValue;
            if (name.toLowerCase() === 'loop')
                this.#video.loop = newValue;
        }
    }

    addSource(src, type) {
        let sourceElement = this.#video.appendChild(document.createElement('source'));
        sourceElement.src = src;
        if (type)
            sourceElement.type = type;
        this.#video.appendChild(sourceElement);
    }

    #updateTextTracks() {
        console.log("updateTextTracks");

        let captionsButton = this.shadowRoot.querySelector('.captions');

        if (this.#video.textTracks.length === 0) {
            captionsButton.classList.toggle('hidden', true);
            return;
        }

        captionsButton.classList.toggle('hidden', false);

        let captionsOnOption = this.shadowRoot.querySelector('.captions-menu #captions-on');
        captionsOnOption.checked = this.#hasEnabledTracks;

        let stylesSection = this.shadowRoot.querySelector('.captions-menu .section.styles');
        stylesSection.classList.toggle('hidden', this.#video.showCaptionDisplaySettings == undefined)
    }

    #toggleCaptions(event) {
        let captionsButton = this.shadowRoot.querySelector('.captions');
        let captionsMenu = this.shadowRoot.querySelector('.captions-menu');
        captionsMenu?.togglePopover({source: captionsButton});
    }

    async #showCaptionSettings(event) {
        await this.#video.showCaptionDisplaySettings({anchorNode: event.target, positionArea: "right center"});
        let captionsMenu = this.shadowRoot.querySelector('.captions-menu');
        captionsMenu?.hidePopover();
    }

    #updateCaptionsEnabled(event) {
        let captionsOnOption = this.shadowRoot.querySelector('.captions-menu #captions-on');
        if (captionsOnOption?.checked) {
            this.#video.textTracks[0].mode = 'showing';
        } else {
            Array.from(this.#video.textTracks).forEach(track => track.mode = 'disabled');
        }
    }

    get #hasEnabledTracks() {
        return Array.from(this.#video.textTracks).some(track => track.mode === 'showing' && ['captions', 'subtitles'].includes(track.kind))
    }

    #template = `
<link rel="stylesheet" href="video-container.css">
<div id=root>
    <video>
        <slot name="source"></slot>
        <slot name="track"></slot>
    </video>
    <div class=video-controls>
        <div class=video-controls-bar>
            <div class="play-pause button">
                <div class=icon></div>
            </div>
            <div class="mute button">
                <div class=icon></div>
            </div>
            <div class="current-time">00:00</div>
            <input type=range class="timeline" step=0.1 min=0 max=1 value=0>
            <div class="remaining-time">00:00</div>
            <div class="captions button">
                <div class=icon></div>
            </div>
            <div class="menu captions-menu" popover>
                <div class="item disabled">Subtitles</div>
                <div class="item">
                    <input type="radio" id="captions-on" name="enable-captions" value="on" />
                    <label for="captions-on">On</label>
                </div>
                <div class="item">
                    <input type="radio" id="captions-off" name="enable-captions" value="off" checked />
                    <label for="captions-off">Off</label>
                </div>
                <div class="section languages">
                    <hr />
                    <div class="item button submenu">Languages</div>
                </div>
                <div class="section styles">
                    <hr />
                    <div class="item button submenu">Styles</div>
                </div>
            </div>
            <div class="pip button">
                <div class=icon></div>
            </div>
            <div class="fullscreen button">
                <div class=icon></div>
            </div>
        </div>
    </div>
</div>`
}
