import numpy as np
from flask import Flask, render_template, request, flash, jsonify
from utils import *

app = Flask(__name__)


@app.route('/', methods=['GET', 'POST'])
def homepage():
    func = cal_position_CM
    flat = 'raw'
    trace_id = 0
    if request.method == 'POST':
        if request.form['algo'] == 'lsm':
            func = cal_position_LSM
        flat = request.form['flat']
    loc = fetch_trace(trace_id, func, flat)

    if request.method == 'POST':
        return jsonify(loc.tolist())
    return render_template('index.html', url='/', loc=loc.tolist())


@app.route('/realtime', methods=['GET', 'POST'])
def realtime():
    client_mac = "d8:ce:3a:fa:9d:03"
    if request.method == 'POST':
        client_mac = request.form['mac']
    df = get_latest(client_mac)
    if df is not None and df.shape[0] == 3:
        dis_arr = [cal_dis_from_rssi(df, AN_lst)]
        dis_np = np.vstack(dis_arr)
        loc = cal_position_LSM(router_loc, dis_np)
        loc -= np.ones_like(loc) * 3.875
        return render_template('index.html', url='/realtime', loc=loc.tolist())
    else:
        # MessageBox the error
        flash("No data found")


if __name__ == '__main__':
    app.run()
