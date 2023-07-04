# 为龙架构移植 thunderbird 操作手册

@KFERMercer: 此文档可能仍存在纰漏, 如有错误请反馈.

- [为龙架构移植 thunderbird 操作手册](#为龙架构移植-thunderbird-操作手册)
  - [简介](#简介)
  - [编译打包指南](#编译打包指南)
    - [物料准备](#物料准备)
    - [编译打包](#编译打包)
  - [开发工作流](#开发工作流)

---

## 简介

[本代码仓库](https://github.com/loongsonedu/thunderbird-porting-demo.git)是 [北京工学宝](https://loongsonedu.cn/) 联合 [龙芯中科](https://www.loongson.cn/) 与 [龙芯俱乐部](https://loonglab.cn/) 为了帮助 2023 届[中国软件杯 龙芯 A2 赛题](https://www.cnsoftbei.com/plus/view.php?aid=793)参赛队伍设立的为 Loongarch 处理器架构移植 thunderbird 78 版本的示例项目.

本仓库分为两个分支, 分别为 [`1%78.14.0-1_deb10u1`](https://github.com/loongsonedu/thunderbird-porting-demo/tree/1%2578.14.0-1_deb10u1) 和 [`developing`](https://github.com/loongsonedu/thunderbird-porting-demo/tree/developing).

二者有以下区别:

- [`1%78.14.0-1_deb10u1`](https://github.com/loongsonedu/thunderbird-porting-demo/tree/1%2578.14.0-1_deb10u1):

    本分支为主线分支. 用于进行最终的编译, 打包和发布. ***不应***在此分支直接修改***除*** [`/debian`](https://github.com/loongsonedu/thunderbird-porting-demo/tree/1%2578.14.0-1_deb10u1/debian) 和 [`/loongarch-porting`](https://github.com/loongsonedu/thunderbird-porting-demo/tree/1%2578.14.0-1_deb10u1/loongarch-porting) 目录***以外***的任何内容.

- [`developing`](https://github.com/loongsonedu/thunderbird-porting-demo/tree/developing):

    本分支开发分支. 用于直接修改代码以进行测试. 如要将修改后的代码并入 `1%78.14.0-1_deb10u1` 分支, 则需自行生成代码 `.patch` 文件并放入适当的地方.

[此处](#开发工作流)简单示范了两个分支间的工作流程.

## 编译打包指南

### 物料准备

本节操作需要以下物料:

1. 安装 [`loongnix`](http://www.loongnix.cn/zh/loongnix/), 并具有图形界面的 `loongarch64` 架构开发机.

   ```shell
   # 使用以下命令查看当前系统信息:
   sudo apt install -y neofetch && neofetch
   ```

2. rust-1.65.0-loongarch64-1.tgz ([点击下载](https://cdn2.loonglab.cn/rust-1.65.0-loongarch64-1.tgz))

    因为 loongnix 软件仓库中的 rustc 不能满足 thunderbird 78 的编译需求, 需要另行安装更新版本.

### 编译打包

```shell
# 以下操作均在龙芯开发机上进行

# 保持目录一致性:
cd ~

# 准备编译环境:
sudo apt update && sudo apt -y upgrade
sudo apt-get build-dep thunderbird

# 由于 78 版本环境依赖与 68 版本略有不同, 所以需要卸载一些软件包:
sudo apt remove --purge rustc* cbindgen

# 环境清理:
rm -rf ~/.cargo

# 下载并解包 rust-1.65.0:
wget https://cdn2.loonglab.cn/rust-1.65.0-loongarch64-1.tgz
tar xzvf ./rust-1.65.0-loongarch64-1.tgz

# 安装 rustc-1.65.0:
echo "export PATH=$(pwd)/rust-1.65.0-loongarch64/bin:${HOME}/.cargo/bin:"'$PATH' >> ~/.profile
echo "export LD_LIBRARY_PATH=$(pwd)/rust-1.65.0-loongarch64/lib:"'$LD_LIBRARY_PATH' >> ~/.profile
source ~/.profile

# cargo 手动编译安装 cbindgen:
cargo install --version 0.14.3 cbindgen

# 创建项目总目录:
mkdir -p ./project-thunderbird78 && cd ./project-thunderbird78

# 克隆仓库并进入源码目录:
git clone https://github.com/loongsonedu/thunderbird-porting-demo.git && cd ./thunderbird-porting-demo

# 选择你要编译的分支 (以 1%78.14.0-1_deb10u1 分支为例):
git checkout 1%78.14.0-1_deb10u1

# 开始编译并静待编译完成:
dpkg-buildpackage -b -d -uc -us

# 查看编译成果:
ls -l ../

# 在系统中安装编译好的 thunderbird78 软件:
sudo apt install -y ../thunderbird_78.14.0-1~deb10u1.loonglab.1_loongarch64.deb thunderbird-l10n-zh-cn_78.14.0-1~deb10u1.loonglab.1_all.deb ../lightning_78.14.0-1~deb10u1.loonglab.1_all.deb ../lightning-l10n-zh-cn_78.14.0-1~deb10u1.loonglab.1_all.deb
```

## 开发工作流

所有对 thunderbird 代码的直接修改都应该***只***在 [`developing`](https://github.com/loongsonedu/thunderbird-porting-demo/tree/developing) 分支下完成.

假定你现在已经对代码做出了一些更改, 并想将更改合并回 [`1%78.14.0-1_deb10u1`](https://github.com/loongsonedu/thunderbird-porting-demo/tree/1%2578.14.0-1_deb10u1) 主线:

```shell
# 生成 .patch 文件:
./loongarch-porting/gen-patch.sh ./debian/patches/[路径]/Name-your-file.patch

# 丢弃你对 thunderbird 代码做出的所有更改 (危险!!):
git checkout -- . ':!debian' ':!loongarch-porting'

# 检出 1%78.14.0-1_deb10u1 分支:
git checkout 1%78.14.0-1_deb10u1

# 使能生成的 .patch 文件:
echo '[路径]/Name-your-file.patch' >> ./debian/patches/series

# 暂存更改:
git add .

# 提交 (如果你不知道此条命令的意义, 请不要执行):
git commit
```
