# By 杨昊翔，罗宇轩

import numpy as np
import pandas as pd
import os
from datetime import datetime
import matplotlib.pyplot as plt
from scipy.optimize import curve_fit


def rssi_dis_function(_rssi, A, N):
    return pow(10, np.float64((abs(_rssi) - A) / (10 * N)))


def fit_A_N(xlsx_path, avg_win_sz=3):

    def f(_sub_df):
        # do something with the sub-DataFrame
        _sub_df = _sub_df.dropna(axis=0, how='all')
        dis = _sub_df.iloc[0, 1]
        _sub_df = _sub_df.copy()
        
        _sub_df.loc[:, 'rssi_num'] = _sub_df.apply(lambda s: -float(str(s.rssi).strip('|').split('|')[0].strip()), axis=1)
        rssi_lst = _sub_df['rssi_num'].to_numpy()
        rssi_lst = np.convolve(rssi_lst, np.ones((avg_win_sz,))/avg_win_sz, mode='valid')
        avg_rssi = np.mean(rssi_lst)
        return dis, avg_rssi

    rssi = []
    distance = []
    rssi_dis_df = pd.DataFrame(pd.read_excel(xlsx_path))
    rssi_dis_df = rssi_dis_df[["rssi", "真实距离"]]
    # define the function f to process each sub-DataFrame

    # find the indices of the non-NaN values in the "真实距离" column
    split_indices = rssi_dis_df.index[rssi_dis_df['真实距离'].notna()]

    # split the DataFrame into sub-DataFrames based on the split_indices
    sub_dfs = np.split(rssi_dis_df, split_indices)[1:]

    # process each sub-DataFrame using the function f
    for sub_df in sub_dfs:
        dis, avg_rssi = f(sub_df.copy())
        distance.append(dis)
        rssi.append(avg_rssi)

    A, N = curve_fit(rssi_dis_function, rssi, distance)[0]
    if debug1:
        plt.scatter(rssi, distance, marker='o',label='real')
        x = np.arange(30, 70, 0.01)
        y = np.array([rssi_dis_function(x1, A, N) for x1 in x])
        plt.plot(x, y,color='red',label='curve_fit')
        # y_discrete = [rssi_dis_function(y1, A, N) for y1 in rssi]
        plt.xlabel("abs(rssi) (dBm)")
        plt.ylabel("distance (m)")
        plt.title("Rssi-distance curve fit")
        plt.legend()
        plt.show()
    return A, N

def read_data():
    '''
    output:
        list, t dataframes, columns: router_id, time, rssi
    '''

    df_lst = [] 
    df_data = pd.DataFrame(pd.read_excel("data.xlsx"))

    # Find indices where all values in a row are NaN
    split_indices = df_data.index[df_data.isnull().all(axis=1)].tolist()
    
    # Add the last index of the dataframe to split_indices
    split_indices.append(df_data.shape[0])
    
    # Initialize start index
    start_index = 0
    
    # Iterate over split_indices to split the dataframe and process each sub-dataframe
    for index in split_indices:
        sub_df = df_data.iloc[start_index:index]
        if not sub_df.empty:
            df_lst.append(sub_df)
        start_index = index + 1

    return df_lst


def cal_dis_from_rssi(df, AN_lst, rm=0):
    '''
    output:
        dis_lst, len = 3
    '''
    # avg distance
    df_rssi_group = df.groupby('router_id')
    df_rssi = df_rssi_group.apply(lambda x: list(x['rssi']))

    _dis_lst = [[rssi_dis_function(rssi, A, N) for rssi in rssi_lst] for rssi_lst, (A, N) in zip(df_rssi, AN_lst)]
    dis_lst = []
    for lst in _dis_lst:
        for j in range(rm):
            lst.remove(min(lst))
            lst.remove(max(lst))

        dis_lst.append(sum(lst) / len(lst))

    # print(dis_lst)
    return dis_lst

def cal_position_CM(sensors_loc, dis_np):
    X = []
    e = 0.2  # 允许的误差范围
    for dis in dis_np:
        found = False  # 是否已经找到近似交点
        tmp_p = None
        intersection_of_circles1, intersection_of_circles2 = None, None
        point = np.zeros(2,)
        for i in range(3):
            assert dis[i] >= 0
            if found:
                break
            for j in range(i+1, 3):
                dis_btn_devices = np.sqrt(np.sum((sensors_loc[i] - sensors_loc[j])**2))
                if dis[i] + dis[j] >= dis_btn_devices:
                    dr = dis_btn_devices / 2 + (dis[i]**2 - dis[j]**2) / (2 * dis_btn_devices)
                    half_common_string = np.sqrt(abs(dis[i]**2 - dr**2))
                    tmp_p = sensors_loc[i] + (sensors_loc[j] - sensors_loc[i]) * dr / dis_btn_devices
                    cossin = (sensors_loc[j] - sensors_loc[i]) / dis_btn_devices
                    cossin[0] = -cossin[0]
                    intersection_of_circles1 = tmp_p + half_common_string * cossin
                    intersection_of_circles2 = tmp_p - half_common_string * cossin
                else:
                    tmp_p = sensors_loc[i] + (sensors_loc[j] - sensors_loc[i]) * dis[i] / (dis[i]+dis[j])

                if dis[i] + dis[j] >= dis_btn_devices:
                    k = 3-i-j
                    dev1 = np.sqrt(np.sum((intersection_of_circles1 - sensors_loc[k])**2))
                    dev2 = np.sqrt(np.sum((intersection_of_circles2 - sensors_loc[k])**2))
                    if dev1 <= dis[k] + e and dev1 >= dis[k] - e:
                        X.append(intersection_of_circles1+(sensors_loc[k]-intersection_of_circles1)*(1-dis[k]/dev1)/2)
                        found = True
                        break
                    if dev2 <= dis[k] + e and dev2 >= dis[k] - e:
                        X.append(intersection_of_circles2+(sensors_loc[k]-intersection_of_circles2)*(1-dis[k]/dev2)/2)
                        found = True
                        break
                point += tmp_p

        if not found:
            X.append(point/3)

    X = np.vstack(X)
    return X

def cal_position_LSM(sensors_loc, dis_np):
    '''
    input: 
        sensors_loc: (3,2)
        dis_np: (t,3)
    output:
        (t,2)
    '''
    A = np.diff(sensors_loc, axis=0) * 2
    sensor_diff_sum_of_square = np.diff(np.sum(sensors_loc**2, axis=1)) # (2, )
    dis_diff_of_square = -np.diff(dis_np**2, axis=1) # (t,2)
    B = sensor_diff_sum_of_square + dis_diff_of_square
    B = B.T # (2,t)
    X = np.linalg.inv(A.T @ A) @ A.T @ B # (2,t)
    X = X.T
    return X

def cal_seq_positions(sensors_loc, dis_np, way='LSM'):
    if way == 'LSM':
        seq_positions = cal_position_LSM(sensors_loc, dis_np)
    elif way == "CM":
        seq_positions = cal_position_CM(sensors_loc, dis_np)

    return seq_positions

def plot_traj(title, seq_positions, gt_traj, draw_gt=False):
    plt.scatter(seq_positions[:,0], seq_positions[:,1], s=10)
    for i in range(seq_positions.shape[0]-1):
        plt.plot(seq_positions[i:i+2][:,0],seq_positions[i:i+2][:,1], c='b')
    for i in range(len(seq_positions)):
        plt.annotate(i, (seq_positions[i,0], seq_positions[i,1]))

    if draw_gt:
        l = gt_traj.shape[0]
        for i in range(l):
            if i == l-1:
                plt.plot([gt_traj[-1][0], gt_traj[0][0]], [gt_traj[-1][1], gt_traj[0][1]])
            else:
                plt.plot([gt_traj[i][0], gt_traj[i+1][0]], [gt_traj[i][1], gt_traj[i+1][1]])

    plt.title(title)
    plt.savefig(title+'.eps')
    plt.show()


def my_parse(sequences, threshold = -0.3, loop = 5):
    '''
    By 罗宇轩
    input a (N,2) dim numpy array, output a modified sequence:
    loop: iterations to selectively smooth point sequences
    alpha: step size
    '''
    alpha = 0.1

    length = sequences.shape[0]
    for l in range(loop):
        for i in range (length-1):
            vec1 = sequences[i-1] - sequences[i]
            vec1 = vec1 / np.linalg.norm(vec1)
            vec2 = sequences[(i+1)%length] - sequences[i]
            vec2 = vec1 / np.linalg.norm(vec2)

            cos_sim = np.inner(vec1, vec2)

            delta = (sequences[i+1] - sequences[i-1])
            center = (sequences[i+1] + sequences[i-1])/2
            
            if cos_sim >=threshold:
                # Fit to the perpendicular direction
                right_angle_pt = center + np.array([-delta[1], delta[0]])/2
                diff_vec = right_angle_pt - sequences[i]
                # iteratively update points
                sequences[i] += alpha * diff_vec
            
            else:
                diff_vec = center - sequences[i]
                # iteratively update points
                sequences[i] += alpha * diff_vec

    return sequences

def main():
    xlsx_path_lst = ["00f3eb23", "00f403e9", "00f4041b"]
    sensors_loc = np.array([[5.55, 7.24], [6.7, 0.94], [1.65, 0.86]])

    way = 'CM' # 'CM' or 'LSM'
    gt_traj = None
    draw_gt = False
    moving_avg = True
    window_size = 3
    post_process = False


    ####################

    title = f"Trajectory_{way}"
    if post_process:
        title += "+iter"
    elif moving_avg:
        title += "+avg"
    AN_lst = [fit_A_N(xlsx_path+".xlsx") for xlsx_path in xlsx_path_lst]

    df_lst = read_data()
    t_dis_lst = [cal_dis_from_rssi(df, AN_lst) for df in df_lst] # t 3 

    dis_np = np.vstack(t_dis_lst) # (t,3)

    seq_positions = cal_seq_positions(sensors_loc, dis_np, way) # (t,2)
    if post_process:
        seq_positions = my_parse(seq_positions)

    if moving_avg:
        tmp_x = np.convolve(seq_positions[:,0], np.ones((window_size,))/window_size, mode='valid')
        tmp_y = np.convolve(seq_positions[:,1], np.ones((window_size,))/window_size, mode='valid')
        seq_positions = np.vstack([tmp_x, tmp_y]).T

    plot_traj(title, seq_positions, gt_traj, draw_gt)

if __name__ == "__main__":
    debug = True
    debug1 = False
    main()