# Project 1 无线信号感知与室内定位

| 姓名  | 学号         |
| --- | ---------- |
| 魏鑫  | 1900013525 |
| 罗宇轩 | 2000017426 |
| 杨昊翔 | 2000017741 |
| 梁博强 | 2000017421 |

----------

# 如何运行本项目

0. 在 [`config.json`](./config.json) 中填入您的数据库配置

1. 安装所有包依赖

   ```shell
   pip install -r requirements.txt
   ```

2. 运行 [`preprocessing.ipynb`](./preprocessing.ipynb) 将测试数据导入数据库

3. 使用 npm 安装包并且构建出运行时 javascript

   ``` shell
   cd static
   npm install
   npx webpack build
   ```

4. 运行 Flask 服务器

   ```shell
   cd ..
   flask run
   ```

5. 打开 http://127.0.0.1:5000/ 以查看



# 搭建服务器和MySQL数据库


## 架构

我们选择使用XAMPP管理服务器和数据库。XAMPP包括了Apache Web Server, MySQL Database(MariaDB), PHP等功能，方便进行本地服务器的开发。在完成下载后启动MySQL Database和Apache Web Server即可在分别在port 3306和port 80使用数据库和服务器功能。此后在浏览器中访问`localhost/phpmyadmin`即可进入图形化数据库管理界面。


## 数据库和表的创建

首先创建名为`db_data`的数据库，接着使用下述语句创建名为`tbl_data`的表

    CREATE TABLE tbl_data (
        data_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        router_id TEXT,
        router_mac TEXT,
        send_time TEXT,
        latitude FLOAT,
        longitude FLOAT,
        phone_mac TEXT,
        rssi FLOAT,
        distance FLOAT
    );

这个表包含九个字段：`data_id`作为主键是一个自增型的变量，作为唯一的identifier； `router_id`是设备的id； `router_mac`是设备的mac地址； `send_time`作为timestamp表示接受数据的时间； `latitude`是设备的纬度；`longitude`是设备的精度； `phone_mac`是被定位手机的mac地址； `rssi`为设备探测到被定位手机发出的WiFi信号的强度； `distance`是根据`rssi`计算出来的被定位手机与设备的距离。

# 接收采集WiFi包

被定位手机会以一定频率发送WiFi信号包，此后被配置好的设备的WiFi探针接收并转发到指定url。在这里我们选择使用php语言处理WiFi信号包并将其插入到数据库中。


## 连接数据库

使用

    // database connection code
    // $con = new mysqli('localhost', 'database_user', 'database_password', 'database')
    $con = new mysqli('localhost', 'root', '','db_data');

与数据库建立连接；


## 字段读取与插入代码

接着获取packet中的`data`字段并decode，分别获取其中的`id`, `mmac`, `lat`, `lon`字段，并迭代获取`data`数组中移动设备的信息。在每次循环中判断移动设备的mac地址是否与被定位手机的mac地址相等，如果相等则获取`rssi`与`range`字段，并插入数据库，否则直接进入下次循环。插入代码如下

    // insert an item to database
        $sql = "INSERT INTO `tbl_data` (
            `data_id`
            `router_id`,
            `router_mac`,
            `latitude`,
            `longitude`,
            `send_time`,
            `phone_mac`,
            `rssi`,
            `distance`
            )
            VALUES ('NULL', '$router_id', '$router_mac', '$lat', '$lon', '$date_format', '$mac', '$rssi', '$range')";



## 数据采集

我们在三教使用上述方式和代码完成了数据采集。关于三台嗅探器以及采集轨迹的ground truth如下图：

![](https://paper-attachments.dropboxusercontent.com/s_B2E5874652714A1C6051AFA64D0DD1D13C3A0405A1EDF2A397C9FB1EE6FEBB47_1683221099391__20230505012438.jpg)


其中，两两标定点等间隔分布。我们从第一个标定点出发，顺时针行走，在此过程中三个嗅探器捕捉到移动手机广播的包，将设备以及手机的MAC地址，rssi值发送给服务器端。

在采集数据之前，我们先利用卷尺，分别对三台嗅探器的距离以及其 $rssi$ 值进行测量，每组数据测量20个并剔除离群点，为了更好地拟合 $rssi$ 与距离的关系。具体内容请参阅“后端 · 拟合参数”部分。


# 后端


## 拟合参数

首先我们分别用三个嗅探器采集标定数据。对于每一个嗅探器，选取8-12个位置，范围在距嗅探器0.5米到7.5米之间，将手机放在选定位置固定不动，在每个位置上测量多个信号接收强度 $rssi$ 和实际距离 $d$ 。对于测得的数据，先删除一些离群值，然后对 $rssi$ 值取平均得到与实际距离对应的一个 $rssi$ 值。
根据公式
$$d=10^{\frac{abs(rssi)-A}{10*n}}$$
拟合 $A$ 和 $n$ ，其中 $d$ 为实际距离， $A$ 为发射端和接收端相隔1米时的信号强度， $n$ 为环境衰减因子。拟合选用`scipy.optimize.curve_fit`，使用非线性最小二乘法。其中一个嗅探器拟合结果如下图。

![](https://paper-attachments.dropboxusercontent.com/s_39D1C697C4E36CD4BABCE1AD656DC787FCD42A9AF5204F04FECE55B572511C10_1683252291278_curve_fit2.png)

## 定位算法

如下一部分所述采集沿轨迹行进时的数据，统一时刻，根据 $rssi$ 删除一些离群值，对于三个嗅探器分别使用上述公式和拟合得到的 $A$ 和 $n$ 值计算实际距离，对距离取平均值，得到各时刻手机分别到三个嗅探器的距离。随后用两种方法做定位。

**最小二乘法LSM**

设三个嗅探器位置分别为 $(x_0,y_0), (x_1,y_1), (x_2,y_2)$ ，某一时刻手机位置 $(x,y)$ ，到三个嗅探器距离分别为 $d_0,d_1,d_2$ 。可以写出如下方程组：

$$\begin{cases}(x-x_0)^2 + (y-y_0)^2 = d_0^2 &(1)\\ (x-x_1)^2 + (y-y_1)^2 = d_1^2 &(2)\\ (x-x_2)^2 + (y-y_2)^2 = d_2^2 &(3)\end{cases}$$

 $(2)-(1), (3)-(2)$ 后写成矩阵形式： $AX=B.$ 其中:

```math
X = \begin{bmatrix} x \\ y \end{bmatrix}, A = \begin{bmatrix} 2(x_1-x_0) & 2(y_1-y_0) \\ 2(x_2-x_1) & 2(y_2-y_1) \end{bmatrix}, B = \begin{bmatrix} d_0^2 - d_1^2 - x_0^2 - y_0^2 + x_1^2 + y_1^2 \\ d_1^2 - d_2^2 - x_1^2 - y_1^2 + x_2^2 + y_2^2 \end{bmatrix}.
```

 由于测量误差，使用最小二乘法最小化误差 $||AX-B||^2$ ，求导后设导数为0得到 $X=(A^TA)^{-1}A^TB$ ，为该时刻手机坐标。如此得到各个时刻的手机坐标。

**三角形质心法CM**

若存在两个设备，其根据计算距离所得到的两个圆有交点，且存在一个交点，在第三个圆的半径误差范围内，则根据该交点和第三个圆计算近似交点，作为最终交点。计算近似交点H$，如两圆有交点图所示：
$$\vec{OH}=\vec{OG}+\frac{1}{2}(1-\frac{d_E}{|\vec{GE}|})\vec{GE}$$. 

![两圆有交点](https://paper-attachments.dropboxusercontent.com/s_39D1C697C4E36CD4BABCE1AD656DC787FCD42A9AF5204F04FECE55B572511C10_1683257362264_image.png)
![两圆无交点](https://paper-attachments.dropboxusercontent.com/s_39D1C697C4E36CD4BABCE1AD656DC787FCD42A9AF5204F04FECE55B572511C10_1683257448241_image.png)


否则，计算三个设备对应圆的两两模拟交点共三个，两圆相切取切点，相离按半径比例取圆心连线上某点，相交取两个交点连成线段的中点，对三个模拟交点取平均值的点作为最终交点。计算模拟交点 $I$ ，如两圆无交点图所示：
$$\vec{OI}=\vec{OA}+\frac{d_A}{d_A+d_C}\vec{AC}$$. 

## 后处理

对于计算得到的轨迹，分别使用两种后处理方式。我们将于如下详细介绍。

## 三点平均平滑算法

我们首先选择如下平滑算法：对于相邻 $n = 3$ 个点，我们计算其平均值，得到平滑后的坐标点。其优点是简便易行，其缺点是会使最终可视化的点数变少，同时改变轨迹首尾点。

对于该方法，我们的可视化结果如下：

**最小二乘法**

![](https://paper-attachments.dropboxusercontent.com/s_6A99C2AB3C3698DDCB38A1BA57C2DDF8D0A1E6E7909D9485C9596B1C23AACE6F_1683544546473_LSM-avg.png)


**三角形质心法**

![](https://paper-attachments.dropboxusercontent.com/s_6A99C2AB3C3698DDCB38A1BA57C2DDF8D0A1E6E7909D9485C9596B1C23AACE6F_1683544555356_CM-avg.png)

## 迭代平滑算法

在该定位任务上（轨迹已知），我们自主设计了一种迭代平滑算法。具体来说，对于相邻三个点 $x_{i-1},\ x_i,\ x_{i+1}$ ,我们计算向量 $\vec{x_{i}x_{i-1}}$ 与 $\vec{x_{i+1}x_i}$ 的余弦相似度，如果其小于一个阈值（默认-0.3）则认为三点原来处于直线；否则认为原来 $x_i$ 为直角顶点。之后计算 $\vec{x_{i-1}x_{i+1}}$ 的中点 $x_c$ ，计算向量 $\vec{\Delta x_i} = \vec{x_cx_i}$ 作为移动 $x_i$ 的位移向量，迭代更新每个 $x_i$ ，公式如下:  $x_{t+1_{i}} = x_{t_i} = \beta \cdot \vec{ \Delta x_{t_i}}$ 。其中 $t$ 代表迭代次数， $\beta$ 代表更新“学习率”。

该方法的好处是利用了轨迹的先验信息，来尽量恢复边与角的几何特征。同时，其固定了起点与终点，点的个数在微调过程中不变。

对于该方法，我们的可视化结果如下：

**最小二乘法**

![](https://paper-attachments.dropboxusercontent.com/s_6A99C2AB3C3698DDCB38A1BA57C2DDF8D0A1E6E7909D9485C9596B1C23AACE6F_1683544381785_LSM-iter.png)


**三角形质心法**

![](https://paper-attachments.dropboxusercontent.com/s_6A99C2AB3C3698DDCB38A1BA57C2DDF8D0A1E6E7909D9485C9596B1C23AACE6F_1683544417044_CM-iter.png)


根据室内场景以及运动轨迹的情况，我们利用JavaScript设计前端，并使用flask达到与后端算法的实时通讯。

# 前端


## 室内场景建模

我组利用three.js对环境场景进行建模。我们可视化了房间、嗅探器与人物，其中嗅探器使用橙色扩散曲线表示，人物简化为“跳棋”形态，可以在房间内自由移动。具体的三维设计请参考 [`./static/room.js`](./static/room.js) 效果如下图：

同时我们使用Bootstrap框架完善了HTML的网页端界面。它是一个交互式界面，支持多种定制化功能，便于不同算法间动态效果的比较。它是一个用于快速开发 Web 应用程序和网站的前端框架。它基于 HTML、CSS 和JavaScript，提供了一站式解决方案，集成了响应式布局、移动设备优先等特性。
Bootstrap 提供了大量的可重用组件，包括图像、下拉菜单、导航、警告框、弹出框等等。Bootstrap 是一个简洁统一的解决方案，易于定制和使用。基于此，我们实现的可选功能有：实时坐标查询与历史轨迹查询。在历史轨迹查询中，我们支持对已实现的两种方法与两种后处理优化算法的结果展示。详见“结果展示”部分


## 使用Flask与后端通讯

我们使用Flask作为服务端建立一个服务器，用以连接数据库与HTML界面、支持用户的查询操作。

Flask是一个用Python语言编写的轻量级Web开发框架，它主要面向需求简单，项目周期短的小应用。Flask本身相当于一个内核，其他几乎所有的功能都要用到扩展，都需要用第三方的扩展来实现。它提供了丰富的扩展库，可以帮助开发人员快速构建应用程序的功能。

具体来说，当用户在HTML界面点击特定按钮时（比如对历史轨迹的某算法结果查询），Flask框架向数据库发起查询，通过调用对应算法计算出需要渲染的轨迹并创建HTML文件、在JavaScript书写的场景中控制人物的运动、同时使用红色曲线渲染出其运动轨迹。


# 结果展示

这是我们最终服务器展示的录像

https://drive.google.com/file/d/11zMIoXLYKPvGQTGcoVqMNPtW34B0DB7Y/view?usp=drivesdk
