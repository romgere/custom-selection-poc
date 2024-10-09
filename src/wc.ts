// Create a class for the element
class MyCustomElement extends HTMLElement {
  static observedAttributes = ['foo', 'bar'];

  constructor() {
    super();
  }

  connectedCallback() {
    const shadow = this.attachShadow({ mode: 'open' });
    const wrapper = document.createElement('div');
    wrapper.setAttribute('class', 'wrapper');

    const info = document.createElement('span');
    info.textContent = `I am a custom element`;

    const ul = document.createElement('ul');
    for (let attr of MyCustomElement.observedAttributes) {
      const v = this.getAttribute(attr);
      const li = document.createElement('li');
      li.innerText = `I received "${attr}" attribute with value : ${v}`;
      ul.appendChild(li);
    }

    const style = document.createElement('style');

    style.textContent = `
      .wrapper {
        border: 1px solid black;
        background: gray;
      }
    `;

    // Attach the created elements to the shadow dom
    shadow.appendChild(style);

    shadow.appendChild(wrapper);
    wrapper.appendChild(info);
    wrapper.appendChild(ul);
  }
}

customElements.define('my-custom-element', MyCustomElement);
