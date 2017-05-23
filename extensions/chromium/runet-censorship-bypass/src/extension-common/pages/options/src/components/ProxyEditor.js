import Inferno, {linkEvent} from 'inferno';
import Component from 'inferno-component';
import css from 'csjs-inject';

export default function getProxyEditor(theState) {

  const scopedCss = css`

    table.editor {
      border-collapse: collapse;
      /*border-style: hidden;*/
      width: 100%;
      margin: 0.5em 0;
      background-color: #f3f5f6;
    }

    table.editor ::-webkit-input-placeholder {
      color: #c9c9c9;
    }

    table.editor td, table.editor th {
      border: 1px solid #ccc;
      text-align: left;
      height: 100%;
    }

    /* ADD PANEL */
    table.editor tr.addPanel td {
      padding: 0;
    }
    /* PROXY ROW */
    table.editor tr.proxyRow td:first-child {
      text-align: center;
    }

    table.editor th:not(:last-child) {
      padding: 0 0.6em;
    }

    table.editor input:not([type="submit"]),
    table.editor select,
    table.editor select:hover {
      border: none;
      background: inherit !important;
    }
    table.editor select,
    table.editor select:hover {
      -webkit-appearance: menulist !important;
      box-shadow: none !important;
    }
    table.editor input {
      width: 100%;
    }

    /* BUTTONS */
    table.editor input[type="submit"],
    table.editor button {
      min-width: 0;
      min-height: 0;
      width: 100%;
      padding: 0;
      border: none;
    }
    .only {
      /*height: 100%;*/
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
    }
    table.editor .add {
      font-weight: 900;	
    }
    table.editor .export {
      padding-right: 2px;
    }

    /* LAST COLUMN: BUTTONS */
    table.editor tr > *:nth-last-child(1) {
      text-align: center;
      padding: 0;
      position: relative;
      min-width: 1em;
    }
    /* LAST-2 COLUMN: HOSTNAME
    table.editor td:nth-last-child(3) {
      padding-left: 2px;
    }*/
    .noPad {
      padding: 0;
    }
    .padLeft {
      padding-left: 2px;
    }

    textarea.textarea {
      width: 100% !important;
      min-height: 100%;
      height: 6em;
      /* border-width: 1px 0 0 0;*/
      border: none;
    }

    table.editor input:invalid {
      color: red !important;
      border-radius: 0;
      border-bottom: 1px dotted red !important;
    }

  `;

  const UI_RAW = 'ui-proxy-string-raw';
  const MAX_PORT = 65535;
  const onlyPort = function onlyPort(event) {

    if (!event.ctrlKey && (/^\D$/.test(event.key) || /^\d$/.test(event.key) && parseInt(`${this.value}${event.key}`) > MAX_PORT)) {
      event.preventDefault();
      return false;
    }
    // Digits, Alt, Tab, Enter, etc.
    return true;

  };
  const PROXY_TYPE_LABEL_PAIRS = [['PROXY', 'PROXY/HTTP'],['HTTPS'],['SOCKS4'],['SOCKS5'],['SOCKS']];

  return class ProxyEditor extends Component {

    constructor(props) {

      super(props);
      this.state = {
        proxyStringRaw: localStorage.getItem(UI_RAW) || '',
        ifExportsMode: false,

        exportsStatus: '',
        ifChangesStashedForApply: false,
        stashedExports: false,

        newType: 'HTTPS',
      };

      this.switchBtn = (
        <button
          class={'emoji' + ' ' + scopedCss.export + ' ' + scopedCss.only}
          title="импорт/экспорт"
          onClick={linkEvent(this, this.handleModeSwitch)}
        >⇄</button>
      );
      
    }

    handleTextareaChange(that, event) {

      that.setState({stashedExports: event.target.value});

    }
    preventLostOfChanges() {

      window.onbeforeunload = () => true; // TODO

    }

    findErrorsForStashedExports() {

      const valid = true;
      if(this.state.stashedExports === false) {
        return valid;
      }
      const errors = this.state.stashedExports.trim()
        .split(/\s*;\s*/)
        .filter((s) => s)
        .map((proxyAsString) => {

          const [rawType, addr] = proxyAsString.split(/\s+/);
          const knownTypes = PROXY_TYPE_LABEL_PAIRS.map(([type, label]) => type);
          if( !knownTypes.includes(rawType.toUpperCase()) ) {
            return new Error(
              `Неверный тип ${rawType}. Известные типы: ${knownTypes.join(', ')}.`
            );
          }
          if (!(addr && /^[^:]+:\d+$/.test(addr))) {
            return new Error(
              `Адрес "${addr}" не соответствует формату "<домен_или_IP_прокси>:<порт_прокси_из_цифр>".`
            );
          }
          const [hostname, rawPort] = addr.split(':');
          const port = parseInt(rawPort);
          if (port < 0 || port > 65535) {
            return new Error(
              `Порт ${port} должен быть целым числом от 0 до 65535.`
            );
          }
          return false;

        }).filter((e) => e);
      return errors && errors.length ? errors : false;

    }

    handleModeSwitch(that, event) {
      
      event.preventDefault(); // No form submit.
      let newProxyStringRaw = that.state.proxyStringRaw;

      const doSwitch = () => that.setState({
        ifExportsMode: !that.state.ifExportsMode,
        proxyStirngRaw: newProxyStringRaw,
        stashedExports: false,
        exportsStatus: '',
      });

      if (that.state.stashedExports !== false) {

        const errors = that.findErrorsForStashedExports();
        if (!errors) {
          newProxyStringRaw = that.state.stashedExports;
        } else {
          that.setState({exportsStatus: 'Имеются ошибки: <a href>[забыть]</a>?'});
          return that.props.funs.showErrors(...errors);
        }
      }
      doSwitch();

    }

    showInvalidMessage(that, event) {

      that.props.funs.showErrors({message: event.target.validationMessage});

    }

    handleTypeSelect(that, event) {

      that.state.newType = event.target.value;

    }

    handleSubmit(that, event) {

      !that.state.ifExportsMode ? that.handleAdd(that, event) : that.handleModeSwitch(that, event);

    }

    handleAdd(that, event) {

      const form = event.target;
      const elements = Array.from(form.elements).reduce((acc, el, index) => {

        acc[el.name || index] = el.value;
        el.value = '';
        return acc;

      }, {});
      const type = that.state.newType;
      const hostname = elements.hostname;
      const port = elements.port;

      that.setState({proxyStringRaw: `${that.state.proxyStringRaw} ${type} ${hostname}:${port};`.trim()});

      event.preventDefault();

    }
    render(props) {

      return (
        <form onSubmit={linkEvent(this, this.handleSubmit)}>
          {
            !this.state.ifExportsMode
            ? ((
              <table class={scopedCss.editor}>
                <thead>
                  <tr>
                    <th>протокол</th> <th>домен / IP</th> <th>порт</th> <th>{this.switchBtn}</th>
                  </tr>
                </thead>
                <tbody>
                  {/* ADD NEW PROXY STARTS. */}
                  <tr class={scopedCss.addPanel}>
                    <td>
                      <select reqiured
                        class={scopedCss.noPad}
                        name="proxyType"
                        onChange={linkEvent(this, this.handleTypeSelect)}
                      >
                        {
                          PROXY_TYPE_LABEL_PAIRS.map(
                            ([type, label]) =>
                              (<option value={type} selected={type === this.state.newType}>
                                {label || type}
                              </option>)
                          )
                        }
                      </select>
                    </td>
                    <td>
                      {/* LAST-2: HOSTNAME */}
                      <input required
                        class={scopedCss.noPad}
                        placeholder="89.140.125.17" value={this.state.newHostname}
                        name="hostname"
                        onInvalid={linkEvent(this, this.showInvalidMessage)}
                      />
                    </td>
                    <td>
                      {/* LAST-1: PORT */}
                      <input required type="number"
                        class={scopedCss.noPad + ' ' + scopedCss.padLeft} style="min-width: 4em"
                        placeholder="9150" value={this.state.newPort}
                        min="0" step="1" max={MAX_PORT} pattern="[0-9]{1,5}"
                        name="port"
                        onInvalid={linkEvent(this, this.showInvalidMessage)}
                        onkeydown={onlyPort}
                      />
                    </td>
                    <td>
                      {/* LAST */}
                      <input type="submit" class={scopedCss.add + ' ' + scopedCss.only} title="Добавить прокси" value="+"/>
                    </td>
                  </tr>
                  {/* ADD NEW PROXY ENDS. */}
                  {
                    this.state.proxyStringRaw.split(/\s*;\s*/g).filter((s) => s).map((proxyAsString) => {

                      const [type, addr] = proxyAsString.trim().split(/\s/);
                      const [hostname, port] = addr.split(':');
                      return (
                        <tr class={scopedCss.proxyRow}>
                          <td>{type}</td><td>{hostname}</td><td>{port}</td>
                          <td>
                            <button title="Повысить приоритет">↑</button>
                            <br/>
                            <input type="submit" title="Удалить прокси" value="X"/>
                          </td>
                        </tr>
                      );

                    })
                  }
                </tbody>
              </table>

            )) : ((

              <table class={scopedCss.editor}>
                <thead>
                  <tr>
                    <th style="width: 100%">{this.state.exportsStatus || 'Прокси видят содержимое HTTP-сайтов.'}</th>
                    <th style="width: 1%">{this.switchBtn}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colspan="2"><textarea
                        class={scopedCss.textarea}
                        spellcheck={false}
                        placeholder={`
SOCKS5 localhost:9050; # Tor Expert
SOCKS5 localhost:9150; # Tor Browser
HTTPS 11.22.33.44:3143;
PROXY foobar.com:8080; # Not HTTP!`.trim()}
                        onChange={linkEvent(this, this.handleTextareaChange)}
                        value={
                          this.state.stashedExports !== false
                            ? this.state.stashedExports
                            : this.state.proxyStringRaw.replace(/\s*;\s*/g, ';\n')
                        }
                      /></td>
                  </tr>
                </tbody>
              </table>
            ))
          }
        </form>
      );

    };
  }

};
