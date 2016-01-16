'use strict'

import 'babel-polyfill';
import React from 'react';
import ReactDOM from 'react-dom';

const App = React.createClass({
  getDefaultProps() {
    return {
      title: 'Hello Docker!'
    };
  },
  render() {
    return (
      <article className="docker">
        <h1>{this.props.title}</h1>
      </article>
    );
  }
});

ReactDOM.render(
  <App />,
  document.getElementById('react-content')
);
