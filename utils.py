import json

import pandas as pd
import numpy as np
from sqlalchemy import create_engine
from algorithm import *

with open('config.json') as f:
    conf = json.load(f)


engine = create_engine(f"mysql+pymysql://{conf['username']}:{conf['password']}\
@{conf['host']}/{conf['db']}?charset=utf8", encoding='utf-8')

routers = pd.read_sql("SELECT router_id FROM routers", engine)['router_id'].tolist()
router_loc = pd.read_sql("SELECT x,y FROM routers", engine).apply(lambda s: [s.x, s.y], axis=1).to_list()
router_loc = np.array(router_loc)
AN_lst = pd.read_sql("SELECT A,N FROM routers", engine).apply(lambda s: (s.A, s.N), axis=1).to_list()


def get_latest(mac: str = 'd8:ce:3a:fa:9d:03'):
    redf = None
    for r in routers:
        df = pd.read_sql(f"SELECT * FROM data WHERE phone_mac='{mac}' and router_id='{r}' ORDER BY time DESC LIMIT 1", engine)
        if df.shape[0] == 0: return
        if redf is None:
            redf = df
        else:
            redf = redf.append(df)
    return redf


def get_point_df(pid: int):
    df = pd.read_sql(f"SELECT * FROM data WHERE point_id={pid}", engine)
    return df


def get_points_of_trace(tid: int = 0) -> list:
    df = pd.read_sql(f"SELECT DISTINCT point_id FROM data WHERE trace_id={tid}", engine)
    return df['point_id'].tolist()


def moving_average(loc: np.array, window_size=3):
    tmp_x = np.convolve(loc[:, 0], np.ones((window_size,)) / window_size, mode='valid')
    tmp_y = np.convolve(loc[:, 1], np.ones((window_size,)) / window_size, mode='valid')
    seq_positions = np.vstack([tmp_x, tmp_y]).T
    return seq_positions


def fetch_trace(tid=0, func=cal_position_CM, flat='raw'):
    point_ids = get_points_of_trace(tid)
    dis_arr = []
    for p in point_ids:
        df = get_point_df(p)
        dis_arr.append(cal_dis_from_rssi(df, AN_lst))
    dis_np = np.vstack(dis_arr)
    loc = func(router_loc, dis_np)
    if flat == 'ma':
        loc = moving_average(loc)
    elif flat == 'iter':
        loc = my_parse(loc)
    loc -= np.ones_like(loc) * 3.875
    return loc
